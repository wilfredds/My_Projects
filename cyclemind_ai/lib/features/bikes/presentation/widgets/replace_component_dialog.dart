import 'package:cyclemind_ai/app/theme/app_colors.dart';
import 'package:cyclemind_ai/core/constants/app_constants.dart';
import 'package:cyclemind_ai/features/bikes/domain/component_validation.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
// For statusForWear and MaintenanceStatus. Extensions and top-level
// functions are not transitively visible, so the defining library is imported.
import 'package:cyclemind_ai/features/bikes/domain/entities/maintenance_log.dart';
import 'package:cyclemind_ai/features/bikes/domain/usecases/replace_component.dart';
import 'package:cyclemind_ai/features/bikes/presentation/controllers/bikes_providers.dart';
import 'package:cyclemind_ai/features/rides/presentation/controllers/rides_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

/// Opens "Mark replaced" for one component and, if a replacement was
/// recorded, says what happened.
///
/// Shared by the bike screen and the dashboard reminder, so both entry points
/// behave identically.
Future<void> markReplaced(
  BuildContext context, {
  required String bikeId,
  required String componentId,
}) async {
  final done = await showDialog<ComponentReplaced>(
    context: context,
    builder: (_) =>
        ReplaceComponentDialog(bikeId: bikeId, componentId: componentId),
  );
  if (done == null || !context.mounted) return;
  ScaffoldMessenger.of(context)
      .showSnackBar(SnackBar(content: Text(replacementMessage(done))));
}

/// Confirms a replacement and records it.
///
/// Takes ids rather than a snapshot: the write always starts from the live
/// bike. It mirrors `AddRideScreen`'s save semantics: a synchronous re-entry
/// guard, one id per dialog session that is reused on retry, and the dialog
/// stays open with the error when a save fails.
class ReplaceComponentDialog extends ConsumerStatefulWidget {
  const ReplaceComponentDialog({
    super.key,
    required this.bikeId,
    required this.componentId,
  });

  final String bikeId;
  final String componentId;

  @override
  ConsumerState<ReplaceComponentDialog> createState() =>
      _ReplaceComponentDialogState();
}

class _ReplaceComponentDialogState
    extends ConsumerState<ReplaceComponentDialog> {
  final _formKey = GlobalKey<FormState>();
  final _brand = TextEditingController();
  final _lifespan = TextEditingController();
  final _note = TextEditingController();

  /// What the summary describes. It is read ONCE, so the text doesn't change
  /// under the rider while the dialog animates closed after a save.
  Bike? _bike;
  BikeComponent? _component;

  bool _saving = false;
  String? _error;

  /// Generated on the first submit and reused for every retry, NOT per
  /// attempt. The rules deny a repeated id, so an ambiguous retry can't
  /// record the same replacement twice.
  String? _pendingLogId;

  @override
  void initState() {
    super.initState();
    final bike = _liveBike();
    final component =
        bike == null ? null : componentById(bike, widget.componentId);
    _bike = bike;
    _component = component;
    if (component != null) {
      _brand.text = component.brand;
      // A corrupt stored lifespan (0, NaN, ...) must not be offered back.
      _lifespan.text = lifespanError(component.lifespanKm) == null
          ? component.lifespanKm.toStringAsFixed(0)
          : '3000';
    }
  }

  @override
  void dispose() {
    for (final c in [_brand, _lifespan, _note]) {
      c.dispose();
    }
    super.dispose();
  }

  Bike? _liveBike() => bikeById(
      ref.read(bikesStreamProvider).valueOrNull ?? const [], widget.bikeId);

  Future<void> _submit() async {
    // Synchronous guard, before any await or setState: a fast double-tap
    // beats the rebuild that disables the button.
    if (_saving) return;
    if (!_formKey.currentState!.validate()) return;

    // The LIVE bike, never the snapshot this dialog opened with and never a
    // route's `extra`. The components array is written whole, so a stale copy
    // could undo another change.
    final live = _liveBike();
    if (live == null) {
      setState(() => _error = 'This bike is no longer available.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    final result = await ref.read(replaceComponentProvider).call(
          logId: _pendingLogId ??= const Uuid().v4(),
          userId: ref.read(currentUserIdProvider),
          bike: live,
          componentId: widget.componentId,
          brand: _brand.text,
          // Already validated; NaN would be rejected by the use case anyway.
          lifespanKm: parseFiniteKm(_lifespan.text) ?? double.nan,
          note: _note.text,
        );

    if (!mounted) return;
    result.fold(
      // Stay open, keep the inputs and the same id: "Try again" is a retry
      // of THIS replacement, not a new one.
      (f) => setState(() {
        _saving = false;
        _error = f.message;
      }),
      (done) => Navigator.of(context).pop(done),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bike = _bike;
    final component = _component;
    if (bike == null || component == null) {
      return AlertDialog(
        title: const Text('Mark replaced'),
        content: const Text('This component is no longer on this bike.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      );
    }

    final small = Theme.of(context).textTheme.bodySmall;
    final odometer = bike.totalMileageKm;
    final used = component.usedKm(odometer);
    final wear = component.wearFraction(odometer);
    final share = wear.isFinite ? '${(wear * 100).round()}%, ' : '';
    final ridden = used.isFinite ? '${used.toStringAsFixed(0)} km' : 'unknown km';
    final brand = component.brand.isEmpty ? 'the old part' : component.brand;

    return AlertDialog(
      title: Text('Mark ${component.type} replaced',
          maxLines: 2, overflow: TextOverflow.ellipsis),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Removing $brand: $ridden ridden '
                  '($share${_phrase(statusForWear(wear))}).'),
              const SizedBox(height: 8),
              Text(
                'Wear resets to 0% at ${odometer.toStringAsFixed(0)} km and '
                'this goes into ${bike.name}\'s service history. History '
                'entries are permanent.',
                style: small,
              ),
              // The likeliest mistake: recording a part that was only just
              // fitted, for example a second tap after a slow save.
              if (used < 1)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    'This part was fitted at the current odometer reading. '
                    'Recording it again adds a second history entry.',
                    style: small?.copyWith(color: AppColors.warning),
                  ),
                ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _brand,
                enabled: !_saving,
                maxLength: AppConstants.maxComponentTextChars,
                decoration: const InputDecoration(
                    labelText: 'New part brand', counterText: ''),
              ),
              TextFormField(
                controller: _lifespan,
                enabled: !_saving,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration:
                    const InputDecoration(labelText: 'Lifespan (km)'),
                validator: (v) => lifespanError(parseFiniteKm(v)),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _note,
                enabled: !_saving,
                minLines: 1,
                maxLines: 3,
                maxLength: AppConstants.maxServiceNoteChars,
                decoration: const InputDecoration(
                    labelText: 'Note (optional)', counterText: ''),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(_error!,
                      style: const TextStyle(color: AppColors.danger)),
                ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          key: const Key('replace-confirm'),
          onPressed: _saving ? null : _submit,
          child: _saving
              ? const SizedBox(
                  height: 18,
                  width: 18,
                  child: CircularProgressIndicator(strokeWidth: 2))
              : Text(_error == null ? 'Mark replaced' : 'Try again'),
        ),
      ],
    );
  }
}

String _phrase(MaintenanceStatus s) => switch (s) {
      MaintenanceStatus.ok => 'not due yet',
      MaintenanceStatus.dueSoon => 'due soon',
      MaintenanceStatus.overdue => 'overdue',
    };
