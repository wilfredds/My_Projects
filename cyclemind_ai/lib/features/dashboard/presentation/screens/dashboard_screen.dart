import 'package:cyclemind_ai/app/theme/app_colors.dart';
import 'package:cyclemind_ai/core/widgets/stat_card.dart';
import 'package:cyclemind_ai/features/auth/presentation/controllers/auth_controller.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/maintenance_log.dart';
import 'package:cyclemind_ai/features/bikes/domain/usecases/generate_reminders.dart';
import 'package:cyclemind_ai/features/bikes/presentation/controllers/bikes_providers.dart';
import 'package:cyclemind_ai/features/bikes/presentation/widgets/replace_component_dialog.dart';
import 'package:cyclemind_ai/features/bikes/presentation/widgets/status_color.dart';
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
            if (reminders.isEmpty)
              const Card(
                child: ListTile(
                  leading: Icon(Icons.check_circle, color: AppColors.success),
                  title: Text('All components healthy'),
                  subtitle: Text('No maintenance due'),
                ),
              )
            else
              // Each reminder can be acted on where it is shown. Before this,
              // a reminder could only be read: there was no way to say the
              // part had been replaced, so it never went away.
              Card(
                child: Column(
                  children: [
                    for (final r in reminders.take(_maxReminderRows))
                      _ReminderRow(reminder: r),
                    if (reminders.length > _maxReminderRows)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: Text(
                            '+${reminders.length - _maxReminderRows} more '
                            'on your bikes',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ),
                      ),
                  ],
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

/// Reminders are sorted worst-first, so the rows shown are the most urgent.
const _maxReminderRows = 3;

class _ReminderRow extends ConsumerWidget {
  const _ReminderRow({required this.reminder});

  final MaintenanceReminder reminder;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overdue = reminder.status == MaintenanceStatus.overdue;
    return ListTile(
      leading: Icon(overdue ? Icons.error_outline : Icons.warning_amber,
          color: statusColor(reminder.status)),
      title: Text(reminder.message),
      trailing: TextButton(
        onPressed: () => markReplaced(context,
            bikeId: reminder.bikeId, componentId: reminder.component.id),
        child: const Text('Mark replaced'),
      ),
      // Tapping the row opens the bike, for anyone who wants the full wear
      // picture before deciding.
      onTap: () {
        final bike = bikeById(
            ref.read(bikesStreamProvider).valueOrNull ?? const [],
            reminder.bikeId);
        if (bike != null) context.push('/bikes/detail', extra: bike);
      },
    );
  }
}

class _WeekStats {
  _WeekStats({required this.km, required this.elev, required this.calories});
  final double km;
  final double elev;
  final int calories;
}
