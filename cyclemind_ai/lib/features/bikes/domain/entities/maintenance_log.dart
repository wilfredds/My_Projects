import 'package:equatable/equatable.dart';

/// Status of a tracked component relative to its service interval.
enum MaintenanceStatus { ok, dueSoon, overdue }

extension MaintenanceStatusX on MaintenanceStatus {
  String get label => switch (this) {
        MaintenanceStatus.ok => 'OK',
        MaintenanceStatus.dueSoon => 'Due soon',
        MaintenanceStatus.overdue => 'Overdue',
      };
}

/// Wear fraction at which a component becomes "due soon".
const double dueSoonWearFraction = 0.8;

/// Wear fraction at which a component becomes "overdue".
const double overdueWearFraction = 1.0;

/// The ONE definition of the wear thresholds.
///
/// Reminders, tile colours and the status recorded in a service log all go
/// through here, so they cannot disagree. There used to be three inline
/// copies. NaN, reachable only through a corrupt lifespan or odometer,
/// compares false and reads [MaintenanceStatus.ok]; the validators in
/// component_validation.dart are what keep it out.
MaintenanceStatus statusForWear(
  double wear, {
  double dueSoonAt = dueSoonWearFraction,
}) {
  if (wear >= overdueWearFraction) return MaintenanceStatus.overdue;
  if (wear >= dueSoonAt) return MaintenanceStatus.dueSoon;
  return MaintenanceStatus.ok;
}

/// A service-history entry. Maps to `maintenance_logs/{logId}`.
///
/// APPEND-ONLY: firestore.rules denies update and delete. That is what makes a
/// service history worth trusting, and it is also what makes a retried write
/// with the same [id] safe (it is denied instead of recorded twice).
///
/// [status] is the status of the part that was REMOVED, so the history shows
/// whether it was replaced early, when due, or overdue.
class MaintenanceLog extends Equatable {
  const MaintenanceLog({
    required this.id,
    required this.userId,
    required this.bikeId,
    required this.component,
    required this.mileageAtService,
    required this.status,
    required this.serviceDate,
    this.notes = '',
  });

  final String id;
  final String userId;
  final String bikeId;
  final String component;
  final double mileageAtService;
  final MaintenanceStatus status;
  final DateTime serviceDate;
  final String notes;

  MaintenanceLog copyWith({
    String? id,
    String? userId,
    String? bikeId,
    String? component,
    double? mileageAtService,
    MaintenanceStatus? status,
    DateTime? serviceDate,
    String? notes,
  }) {
    return MaintenanceLog(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      bikeId: bikeId ?? this.bikeId,
      component: component ?? this.component,
      mileageAtService: mileageAtService ?? this.mileageAtService,
      status: status ?? this.status,
      serviceDate: serviceDate ?? this.serviceDate,
      notes: notes ?? this.notes,
    );
  }

  @override
  List<Object?> get props => [
        id,
        userId,
        bikeId,
        component,
        mileageAtService,
        status,
        serviceDate,
        notes,
      ];
}
