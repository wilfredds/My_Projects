import 'package:cyclemind_ai/features/auth/presentation/controllers/auth_controller.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
// For MaintenanceStatusX.label used in the snackbar. Extensions are not
// transitively visible, so the defining library must be imported here.
import 'package:cyclemind_ai/features/bikes/domain/entities/maintenance_log.dart';
import 'package:cyclemind_ai/features/bikes/presentation/controllers/bikes_providers.dart';
import 'package:cyclemind_ai/features/rides/domain/usecases/log_ride.dart';
import 'package:cyclemind_ai/features/rides/presentation/controllers/rides_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';

/// Manual ride entry — an odometer, not a training log.
///
/// Ride *recording* is deliberately not our job (riders keep Strava/Garmin for
/// that). What a ride is for here is advancing the selected bike's mileage so
/// component wear moves and maintenance reminders eventually fire.
class AddRideScreen extends ConsumerStatefulWidget {
  const AddRideScreen({super.key});

  @override
  ConsumerState<AddRideScreen> createState() => _AddRideScreenState();
}

class _AddRideScreenState extends ConsumerState<AddRideScreen> {
  /// Sentinel for "no bike". A null-valued DropdownMenuItem makes Flutter show
  /// the hint instead of the item, so the no-bike choice needs a real value.
  static const _noBike = '__none__';

  final _formKey = GlobalKey<FormState>();
  final _title = TextEditingController(text: 'Morning ride');
  final _distance = TextEditingController();
  final _elevation = TextEditingController(text: '0');
  final _duration = TextEditingController();
  final _cadence = TextEditingController();

  bool _saving = false;
  String? _bikeId;
  bool _bikeTouched = false;

  /// Generated once per form session, NOT per attempt. Retrying an ambiguous
  /// save re-sends the same id, which Firestore denies (rides update is
  /// forbidden) instead of applying the odometer increment a second time.
  String? _pendingRideId;

  @override
  void initState() {
    super.initState();
    // Drives the live "4,200 → 4,242 km" preview.
    _distance.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    for (final c in [_title, _distance, _elevation, _duration, _cadence]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save(List<Bike> bikes) async {
    // Synchronous guard, before any await or setState: the disabled-button
    // state only takes effect after a rebuild, which a fast double-tap beats.
    if (_saving) return;
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);

    final user = ref.read(authStateProvider).valueOrNull;
    final selectedId = _effectiveBikeId(bikes);
    final bike = _bikeById(bikes, selectedId);

    final result = await ref.read(logRideProvider).call(
          rideId: _pendingRideId ??= const Uuid().v4(),
          userId: user?.id ?? '',
          title: _title.text.trim(),
          distanceKm: double.parse(_distance.text),
          elevationM: double.tryParse(_elevation.text) ?? 0,
          durationSec: (double.parse(_duration.text) * 60).round(),
          bike: bike,
          cadence: int.tryParse(_cadence.text),
          riderWeightKg: user?.profile.weightKg,
        );

    if (!mounted) return;
    setState(() => _saving = false);

    result.fold(
      (f) {
        // Stay on the screen and keep the form: the ride was NOT saved.
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(f.message)));
      },
      (logged) {
        _pendingRideId = null;
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(_message(logged))));
        context.pop();
      },
    );
  }

  /// Says what actually happened, instead of the old unconditional
  /// "component wear updated" — which was false.
  String _message(RideLogged l) {
    final km = l.ride.distanceKm.toStringAsFixed(1);
    if (!l.odometerMoved) {
      return 'Logged $km km. No bike selected, so no odometer moved.';
    }
    final base = 'Logged $km km — ${l.bikeName} now at '
        '${l.odometerAfterKm!.toStringAsFixed(0)} km.';
    if (l.newlyDue.isEmpty) return base;
    final first = l.newlyDue.first;
    return '$base ${first.component.type} is now ${first.status.label.toLowerCase()}.';
  }

  Bike? _bikeById(List<Bike> bikes, String? id) {
    if (id == null) return null;
    for (final b in bikes) {
      if (b.id == id) return b;
    }
    return null;
  }

  String? _effectiveBikeId(List<Bike> bikes) {
    if (_bikeTouched) return _bikeId;
    return defaultBikeId(bikes, ref.read(ridesStreamProvider).valueOrNull ?? const []);
  }

  @override
  Widget build(BuildContext context) {
    final bikesAsync = ref.watch(bikesStreamProvider);
    final bikes = bikesAsync.valueOrNull ?? const <Bike>[];

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
            _numField(_distance, 'Distance (km)', required: true, positive: true),
            const SizedBox(height: 14),
            _numField(_duration, 'Duration (minutes)',
                required: true, positive: true),
            const SizedBox(height: 14),
            _numField(_elevation, 'Elevation gain (m)'),
            const SizedBox(height: 14),
            _numField(_cadence, 'Avg cadence (rpm, optional)'),
            const SizedBox(height: 20),
            _bikeSection(bikesAsync, bikes),
            const SizedBox(height: 28),
            FilledButton.icon(
              onPressed: _saving ? null : () => _save(bikes),
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

  Widget _bikeSection(AsyncValue<List<Bike>> async, List<Bike> bikes) {
    // Never block saving on the bikes stream: a bikeless ride is always valid.
    if (async.isLoading) {
      return const _BikeNotice(
        icon: Icons.pedal_bike_outlined,
        title: 'Loading your bikes…',
        subtitle: 'You can still save; it just won\'t update an odometer.',
      );
    }
    if (async.hasError) {
      return const _BikeNotice(
        icon: Icons.error_outline,
        title: 'Couldn\'t load your bikes',
        subtitle: 'This ride will save, but it won\'t update an odometer.',
      );
    }
    if (bikes.isEmpty) {
      return _BikeNotice(
        icon: Icons.pedal_bike_outlined,
        title: 'No bikes yet',
        subtitle: 'This ride will be saved, but it won\'t update any odometer '
            'or reminders.',
        action: TextButton(
          onPressed: () => context.push('/bikes/new'),
          child: const Text('Add bike'),
        ),
      );
    }

    final selected = _effectiveBikeId(bikes);
    final bike = _bikeById(bikes, selected);
    final distance = double.tryParse(_distance.text);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DropdownButtonFormField<String>(
          initialValue: selected ?? _noBike,
          decoration: const InputDecoration(
            labelText: 'Bike',
            helperText: 'Adds this ride to the bike\'s odometer.',
          ),
          items: [
            const DropdownMenuItem(
              value: _noBike,
              child: Text('No bike — don\'t track mileage'),
            ),
            for (final b in bikes)
              DropdownMenuItem(
                value: b.id,
                child: Text(
                    '${b.name} · ${b.totalMileageKm.toStringAsFixed(0)} km'),
              ),
          ],
          onChanged: (v) => setState(() {
            _bikeTouched = true;
            _bikeId = v == _noBike ? null : v;
          }),
        ),
        // Shows the promise BEFORE the user commits — the honest counterpart
        // to the snackbar.
        if (bike != null && distance != null && distance > 0)
          Padding(
            padding: const EdgeInsets.only(top: 8, left: 12),
            child: Text(
              'Odometer: ${bike.totalMileageKm.toStringAsFixed(0)} → '
              '${(bike.totalMileageKm + distance).toStringAsFixed(0)} km',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
      ],
    );
  }

  Widget _numField(
    TextEditingController c,
    String label, {
    bool required = false,
    bool positive = false,
  }) {
    return TextFormField(
      controller: c,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      decoration: InputDecoration(labelText: label),
      validator: (v) {
        if (v == null || v.isEmpty) return required ? 'Required' : null;
        final n = double.tryParse(v);
        if (n == null) return 'Enter a number';
        // Caught here rather than as an opaque permission denial later: the
        // security rules reject a negative distance outright.
        if (positive && n <= 0) return 'Must be more than 0';
        if (!positive && n < 0) return 'Cannot be negative';
        return null;
      },
    );
  }
}

class _BikeNotice extends StatelessWidget {
  const _BikeNotice({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.action,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Card(
        child: ListTile(
          leading: Icon(icon),
          title: Text(title),
          subtitle: Text(subtitle),
          trailing: action,
        ),
      );
}
