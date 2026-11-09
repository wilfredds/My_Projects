import 'package:cyclemind_ai/app/theme/app_colors.dart';
import 'package:cyclemind_ai/core/widgets/stat_card.dart';
import 'package:cyclemind_ai/features/auth/presentation/controllers/auth_controller.dart';
import 'package:cyclemind_ai/features/bikes/presentation/controllers/bikes_providers.dart';
import 'package:cyclemind_ai/features/rides/domain/entities/ride.dart';
import 'package:cyclemind_ai/features/rides/presentation/controllers/rides_providers.dart';
import 'package:cyclemind_ai/features/rides/presentation/widgets/ride_tile.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Home dashboard: recent mileage and bike health.
///
/// Deliberately not a training dashboard. Readiness scores and coaching plans
/// were removed in the pivot: they competed with Strava/Garmin on data we do
/// not capture. What we own is the *bike* — its wear, and soon its identity.
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authStateProvider).valueOrNull;
    final rides = ref.watch(ridesStreamProvider).valueOrNull ?? const [];
    final reminders = ref.watch(remindersProvider);

    final week = _weekStats(rides);

    return Scaffold(
      // The single most important affordance in the app: without it, logging a
      // ride is unreachable, which is exactly what happened when the Coach tab
      // was deleted and took the only entry point with it.
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/rides/new'),
        icon: const Icon(Icons.add),
        label: const Text('Log ride'),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('Hi ${user?.profile.displayName ?? 'rider'} 👋',
                style: Theme.of(context).textTheme.headlineSmall),
            Text('Here\'s how your bike is doing',
                style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurfaceVariant)),
            const SizedBox(height: 20),

            const SectionHeader(title: 'This week'),
            Row(
              children: [
                Expanded(
                    child: StatCard(
                        icon: Icons.route,
                        value: '${week.km.toStringAsFixed(0)} km',
                        label: 'Distance')),
                const SizedBox(width: 12),
                Expanded(
                    child: StatCard(
                        icon: Icons.terrain,
                        value: '${week.elev.toStringAsFixed(0)} m',
                        label: 'Climbed',
                        color: AppColors.accent)),
                const SizedBox(width: 12),
                Expanded(
                    child: StatCard(
                        icon: Icons.local_fire_department,
                        value: '${week.calories}',
                        label: 'Calories',
                        color: AppColors.warning)),
              ],
            ),
            const SizedBox(height: 20),

            const SectionHeader(title: 'Bike health'),
            Card(
              child: ListTile(
                leading: Icon(
                  reminders.isEmpty ? Icons.check_circle : Icons.warning_amber,
                  color: reminders.isEmpty ? AppColors.success : AppColors.warning,
                ),
                title: Text(reminders.isEmpty
                    ? 'All components healthy'
                    : '${reminders.length} maintenance alert(s)'),
                subtitle: Text(reminders.isEmpty
                    ? 'No maintenance due'
                    : reminders.first.message),
              ),
            ),
            const SizedBox(height: 20),

            SectionHeader(
              title: 'Recent rides',
              trailing: TextButton(
                onPressed: () => context.push('/rides'),
                child: const Text('See all'),
              ),
            ),
            if (rides.isEmpty)
              Card(
                child: ListTile(
                  leading: const Icon(Icons.directions_bike),
                  title: const Text('No rides yet'),
                  subtitle: const Text(
                      'Log a ride to move your odometer and get maintenance '
                      'reminders.'),
                  onTap: () => context.push('/rides/new'),
                ),
              )
            else
              for (final r in rides.take(3))
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: RideTile(ride: r),
                ),

            // Clearance so the FAB never covers the last card.
            const SizedBox(height: 80),
          ],
        ),
      ),
    );
  }

  _WeekStats _weekStats(List<Ride> rides) {
    final now = DateTime.now();
    final week = rides.where((r) => now.difference(r.startedAt).inDays <= 7);
    return _WeekStats(
      km: week.fold<double>(0, (s, r) => s + r.distanceKm),
      elev: week.fold<double>(0, (s, r) => s + r.elevationM),
      calories: week.fold<int>(0, (s, r) => s + r.calories),
    );
  }
}

class _WeekStats {
  _WeekStats({required this.km, required this.elev, required this.calories});
  final double km;
  final double elev;
  final int calories;
}
