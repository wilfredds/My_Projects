import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/maintenance_log.dart';
import 'package:cyclemind_ai/features/bikes/domain/usecases/generate_reminders.dart';
import 'package:flutter_test/flutter_test.dart';

Bike _bikeWith(BikeComponent c, double totalKm) => Bike(
      id: 'b',
      userId: 'u',
      name: 'Test',
      frame: 'f',
      groupset: 'g',
      tires: 't',
      totalMileageKm: totalKm,
      components: [c],
    );

BikeComponent _component(double installedAt, double lifespan) => BikeComponent(
      id: 'c',
      type: 'Chain',
      brand: 'Shimano',
      installedAtKm: installedAt,
      lifespanKm: lifespan,
    );

void main() {
  const usecase = GenerateReminders();

  test('fresh component produces no reminder', () {
    final reminders =
        usecase.call([_bikeWith(_component(0, 3000), 100)]);
    expect(reminders, isEmpty);
  });

  test('component past lifespan is overdue', () {
    final reminders =
        usecase.call([_bikeWith(_component(0, 1000), 1200)]);
    expect(reminders, hasLength(1));
    expect(reminders.first.status, MaintenanceStatus.overdue);
  });

  test('component near lifespan is due soon', () {
    final reminders =
        usecase.call([_bikeWith(_component(0, 1000), 850)]);
    expect(reminders.single.status, MaintenanceStatus.dueSoon);
  });

  test('reminders sorted by wear descending', () {
    final bike = Bike(
      id: 'b',
      userId: 'u',
      name: 'Test',
      frame: 'f',
      groupset: 'g',
      tires: 't',
      totalMileageKm: 1000,
      components: [_component(0, 1100), _component(0, 800)],
    );
    final reminders = usecase.call([bike]);
    expect(reminders.first.wearFraction,
        greaterThanOrEqualTo(reminders.last.wearFraction));
  });

  test('statusForWear boundaries (the one definition of the thresholds)', () {
    expect(statusForWear(0.7999), MaintenanceStatus.ok);
    expect(statusForWear(0.8), MaintenanceStatus.dueSoon);
    expect(statusForWear(0.9999), MaintenanceStatus.dueSoon);
    expect(statusForWear(1.0), MaintenanceStatus.overdue);
    // NaN compares false everywhere: it must not read as due, and the
    // validators are what keep it out in the first place.
    expect(statusForWear(double.nan), MaintenanceStatus.ok);
  });
}
