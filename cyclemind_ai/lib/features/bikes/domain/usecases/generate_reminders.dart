import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/maintenance_log.dart';

/// A maintenance reminder derived from component wear.
class MaintenanceReminder {
  const MaintenanceReminder({
    required this.bikeId,
    required this.bikeName,
    required this.component,
    required this.status,
    required this.wearFraction,
    required this.message,
  });

  final String bikeId;
  final String bikeName;
  final BikeComponent component;
  final MaintenanceStatus status;
  final double wearFraction;
  final String message;
}

/// Generates maintenance reminders across all of a user's bikes.
///
/// For each tracked component it compares ridden distance to the component's
/// lifespan and emits a [MaintenanceReminder] with an OK / due-soon / overdue
/// status. Pure function — easy to unit test.
class GenerateReminders {
  const GenerateReminders();

  /// [dueSoonThreshold] is the wear fraction (default 0.8) at which a component
  /// is flagged "due soon"; ≥ 1.0 is "overdue". Both live in [statusForWear].
  List<MaintenanceReminder> call(
    List<Bike> bikes, {
    double dueSoonThreshold = dueSoonWearFraction,
  }) {
    final reminders = <MaintenanceReminder>[];
    for (final bike in bikes) {
      for (final c in bike.components) {
        final wear = c.wearFraction(bike.totalMileageKm);
        final status = statusForWear(wear, dueSoonAt: dueSoonThreshold);
        if (status == MaintenanceStatus.ok) continue;
        reminders.add(MaintenanceReminder(
          bikeId: bike.id,
          bikeName: bike.name,
          component: c,
          status: status,
          wearFraction: wear,
          message: status == MaintenanceStatus.overdue
              ? '${c.type} replacement overdue on ${bike.name}.'
              : '${c.type} on ${bike.name} is nearing end of life (${(wear * 100).round()}%).',
        ));
      }
    }
    reminders.sort((a, b) => b.wearFraction.compareTo(a.wearFraction));
    return reminders;
  }
}
