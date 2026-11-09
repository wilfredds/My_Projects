import 'package:cyclemind_ai/core/constants/app_constants.dart';
import 'package:cyclemind_ai/features/bikes/domain/component_validation.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/maintenance_log.dart';
import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';

/// Collects a new component and returns it, or null on cancel. It does not
/// write anything; the caller does.
///
/// It is a StatefulWidget so it owns its controllers. The old inline dialog
/// leaked three of them, and disposing them right after `showDialog` returned
/// would have crashed, because the dialog is still animating out and still
/// using them.
class AddComponentDialog extends StatefulWidget {
  const AddComponentDialog({super.key, required this.odometerKm});

  /// The bike's odometer now. A new part is measured from here.
  final double odometerKm;

  @override
  State<AddComponentDialog> createState() => _AddComponentDialogState();
}

class _AddComponentDialogState extends State<AddComponentDialog> {
  final _formKey = GlobalKey<FormState>();
  final _type = TextEditingController(text: 'Chain');
  final _brand = TextEditingController();
  final _lifespan = TextEditingController(text: '3000');
  final _ridden = TextEditingController(text: '0');

  @override
  void initState() {
    super.initState();
    // Drives the live "starts at N% worn" preview.
    _lifespan.addListener(_refresh);
    _ridden.addListener(_refresh);
  }

  void _refresh() => setState(() {});

  @override
  void dispose() {
    for (final c in [_type, _brand, _lifespan, _ridden]) {
      c.dispose();
    }
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    Navigator.of(context).pop(BikeComponent.fitted(
      id: const Uuid().v4(),
      type: _type.text.trim(),
      brand: _brand.text.trim(),
      lifespanKm: parseFiniteKm(_lifespan.text)!,
      odometerKm: widget.odometerKm,
      alreadyRiddenKm: parseFiniteKm(_ridden.text) ?? 0,
    ));
  }

  /// Shows what the part will read BEFORE it's added, so a worn part being
  /// due straight away is expected rather than a surprise.
  String? _preview() {
    final life = parseFiniteKm(_lifespan.text);
    final ridden = parseFiniteKm(_ridden.text);
    if (life == null || ridden == null || ridden <= 0) return null;
    if (lifespanError(life) != null || alreadyRiddenError(ridden) != null) {
      return null;
    }
    final wear = ridden / life;
    final base = 'Starts at ${(wear * 100).round()}% worn';
    return switch (statusForWear(wear)) {
      MaintenanceStatus.overdue => '$base: already overdue.',
      MaintenanceStatus.dueSoon => '$base: due soon.',
      MaintenanceStatus.ok => '$base.',
    };
  }

  @override
  Widget build(BuildContext context) {
    final preview = _preview();
    const number = TextInputType.numberWithOptions(decimal: true);

    return AlertDialog(
      title: const Text('Add component'),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: _type,
                maxLength: AppConstants.maxComponentTextChars,
                decoration:
                    const InputDecoration(labelText: 'Type', counterText: ''),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Required' : null,
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _brand,
                maxLength: AppConstants.maxComponentTextChars,
                decoration:
                    const InputDecoration(labelText: 'Brand', counterText: ''),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _lifespan,
                keyboardType: number,
                decoration: const InputDecoration(labelText: 'Lifespan (km)'),
                validator: (v) => lifespanError(parseFiniteKm(v)),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _ridden,
                keyboardType: number,
                decoration: const InputDecoration(
                  labelText: 'Already ridden on it (km)',
                  helperText: 'Leave 0 for a brand-new part.',
                ),
                validator: (v) => alreadyRiddenError(parseFiniteKm(v)),
              ),
              if (preview != null)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(preview,
                      style: Theme.of(context).textTheme.bodySmall),
                ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(onPressed: _submit, child: const Text('Add')),
      ],
    );
  }
}
