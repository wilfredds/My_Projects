import 'package:cyclemind_ai/core/constants/app_constants.dart';
import 'package:cyclemind_ai/core/utils/write_ack.dart';
import 'package:cyclemind_ai/features/auth/presentation/controllers/auth_controller.dart';
import 'package:cyclemind_ai/features/bikes/domain/component_validation.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
import 'package:cyclemind_ai/features/bikes/presentation/controllers/bikes_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

/// Register a new bike with its core specs. Components/maintenance are added
/// later from the bike detail screen.
class AddBikeScreen extends ConsumerStatefulWidget {
  const AddBikeScreen({super.key});

  @override
  ConsumerState<AddBikeScreen> createState() => _AddBikeScreenState();
}

class _AddBikeScreenState extends ConsumerState<AddBikeScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _frame = TextEditingController();
  final _groupset = TextEditingController();
  final _tires = TextEditingController();
  final _mileage = TextEditingController(text: '0');

  bool _saving = false;

  /// Generated once per form session, NOT per attempt, as with
  /// `_pendingRideId`. The bike is saved under this id, so a second tap or a
  /// retry rewrites the same bike instead of creating a duplicate.
  String? _pendingBikeId;

  @override
  void dispose() {
    for (final c in [_name, _frame, _groupset, _tires, _mileage]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    // Synchronous guard, before any await or setState: a fast double-tap beats
    // the rebuild that disables the button.
    if (_saving) return;
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);

    final user = ref.read(authStateProvider).valueOrNull;
    final bike = Bike(
      id: _pendingBikeId ??= const Uuid().v4(),
      userId: user?.id ?? '',
      name: _name.text.trim(),
      frame: _frame.text.trim(),
      groupset: _groupset.text.trim(),
      tires: _tires.text.trim(),
      // Validated above, so this parse cannot fail.
      totalMileageKm: parseFiniteKm(_mileage.text) ?? 0,
    );
    final result = await ref.read(bikesRepositoryProvider).addBike(bike);

    if (!mounted) return;
    setState(() => _saving = false);
    final messenger = ScaffoldMessenger.of(context);
    result.fold(
      // Stay on the form: the bike was NOT saved. This used to be ignored, so
      // a rejected bike vanished without a word.
      (f) => messenger.showSnackBar(SnackBar(content: Text(f.message))),
      (ack) {
        if (ack == WriteAck.queued) {
          messenger.showSnackBar(SnackBar(
              content: Text('${bike.name} added. $savedOfflineNote')));
        }
        Navigator.of(context).pop();
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Add bike')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _text(_name, 'Name (e.g. Roadie)',
                required: true, maxChars: AppConstants.maxBikeNameChars),
            const SizedBox(height: 14),
            _text(_frame, 'Frame'),
            const SizedBox(height: 14),
            _text(_groupset, 'Groupset (e.g. Shimano 105)'),
            const SizedBox(height: 14),
            _text(_tires, 'Tires'),
            const SizedBox(height: 14),
            TextFormField(
              controller: _mileage,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration:
                  const InputDecoration(labelText: 'Current mileage (km)'),
              // Mirrors numIn(d.totalMileageKm, 0, 500000). A bike saved
              // offline only meets the rules when it syncs, and a rejection
              // then would remove it without a word.
              validator: (v) => odometerError(parseFiniteKm(v)),
            ),
            const SizedBox(height: 28),
            FilledButton.icon(
              key: const Key('save-bike'),
              onPressed: _saving ? null : _save,
              icon: _saving
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.save),
              label: Text(_saving ? 'Saving…' : 'Save bike'),
            ),
          ],
        ),
      ),
    );
  }

  /// A text field capped at the length the rules accept (`bikeShapeOk`).
  Widget _text(
    TextEditingController c,
    String label, {
    bool required = false,
    int maxChars = AppConstants.maxBikeSpecChars,
  }) {
    return TextFormField(
      controller: c,
      maxLength: maxChars,
      decoration: InputDecoration(labelText: label, counterText: ''),
      validator: required
          ? (v) => (v == null || v.trim().isEmpty) ? 'Required' : null
          : null,
    );
  }
}
