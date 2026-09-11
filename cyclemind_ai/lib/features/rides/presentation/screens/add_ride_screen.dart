import 'package:cyclemind_ai/core/utils/ride_metrics.dart';
import 'package:cyclemind_ai/features/auth/presentation/controllers/auth_controller.dart';
import 'package:cyclemind_ai/features/rides/domain/entities/ride.dart';
import 'package:cyclemind_ai/features/rides/presentation/controllers/rides_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

/// Manual ride entry — an odometer, not a training log.
///
/// Ride *recording* is deliberately not our job (riders keep Strava/Garmin for
/// that). These figures exist to advance component wear and drive maintenance
/// reminders. Calories are estimated from speed/duration/weight via
/// [RideMetrics].
class AddRideScreen extends ConsumerStatefulWidget {
  const AddRideScreen({super.key});

  @override
  ConsumerState<AddRideScreen> createState() => _AddRideScreenState();
}

class _AddRideScreenState extends ConsumerState<AddRideScreen> {
  final _formKey = GlobalKey<FormState>();
  final _title = TextEditingController(text: 'Morning ride');
  final _distance = TextEditingController();
  final _elevation = TextEditingController(text: '0');
  final _duration = TextEditingController(); // minutes
  final _cadence = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    for (final c in [_title, _distance, _elevation, _duration, _cadence]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);

    final user = ref.read(authStateProvider).valueOrNull;
    final distance = double.parse(_distance.text);
    final durationMin = double.parse(_duration.text);
    final durationSec = (durationMin * 60).round();
    final avgSpeed = durationMin > 0 ? distance / (durationMin / 60) : 0.0;
    final calories = RideMetrics.estimateCalories(
      avgSpeedKmh: avgSpeed,
      weightKg: user?.profile.weightKg ?? 72,
      durationSec: durationSec,
    );

    final ride = Ride(
      id: const Uuid().v4(),
      userId: user?.id ?? '',
      title: _title.text.trim(),
      startedAt: DateTime.now(),
      distanceKm: distance,
      elevationM: double.tryParse(_elevation.text) ?? 0,
      avgSpeedKmh: avgSpeed,
      durationSec: durationSec,
      calories: calories,
      cadence: int.tryParse(_cadence.text),
    );

    await ref.read(ridesRepositoryProvider).addRide(ride);

    if (!mounted) return;
    setState(() => _saving = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Logged ${distance.toStringAsFixed(1)} km — '
            'component wear updated.'),
      ),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Log ride')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _title,
              decoration: const InputDecoration(labelText: 'Title'),
            ),
            const SizedBox(height: 14),
            _numField(_distance, 'Distance (km)', required: true),
            const SizedBox(height: 14),
            _numField(_duration, 'Duration (minutes)', required: true),
            const SizedBox(height: 14),
            _numField(_elevation, 'Elevation gain (m)'),
            const SizedBox(height: 14),
            _numField(_cadence, 'Avg cadence (rpm, optional)'),
            const SizedBox(height: 28),
            FilledButton.icon(
              onPressed: _saving ? null : _save,
              icon: _saving
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.save),
              label: Text(_saving ? 'Saving…' : 'Save ride'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _numField(TextEditingController c, String label,
      {bool required = false}) {
    return TextFormField(
      controller: c,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      decoration: InputDecoration(labelText: label),
      validator: (v) {
        if (!required) return null;
        if (v == null || v.isEmpty) return 'Required';
        if (double.tryParse(v) == null) return 'Enter a number';
        return null;
      },
    );
  }
}
