import 'package:cyclemind_ai/core/widgets/empty_state.dart';
import 'package:cyclemind_ai/features/rides/presentation/controllers/rides_providers.dart';
import 'package:cyclemind_ai/features/rides/presentation/widgets/ride_tile.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// The ride logbook: every ride, newest first, with swipe-to-delete.
///
/// Deliberately no chart. This is the odometer's history, not a training log —
/// the trend chart was removed in the pivot and bringing it back would re-add
/// the feature that competed with Strava.
class RidesScreen extends ConsumerWidget {
  const RidesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ridesAsync = ref.watch(ridesStreamProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Rides')),
      floatingActionButton: FloatingActionButton.extended(
        // No hero animation: see dashboard_screen.dart.
        heroTag: null,
        onPressed: () => context.push('/rides/new'),
        icon: const Icon(Icons.add),
        label: const Text('Log ride'),
      ),
      body: ridesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (rides) {
          if (rides.isEmpty) {
            return EmptyState(
              icon: Icons.directions_bike,
              title: 'No rides yet',
              message: 'Log a ride to advance your bike\'s odometer and get '
                  'maintenance reminders.',
              action: FilledButton(
                onPressed: () => context.push('/rides/new'),
                child: const Text('Log a ride'),
              ),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 88),
            itemCount: rides.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (_, i) => RideTile(ride: rides[i], dismissible: true),
          );
        },
      ),
    );
  }
}
