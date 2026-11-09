import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cyclemind_ai/core/constants/app_constants.dart';
import 'package:cyclemind_ai/features/auth/data/models/user_model.dart';
import 'package:cyclemind_ai/features/auth/domain/entities/app_user.dart';
import 'package:cyclemind_ai/features/bike_doctor/data/models/report_model.dart';
import 'package:cyclemind_ai/features/bike_doctor/domain/entities/bike_health_report.dart';
import 'package:cyclemind_ai/features/bikes/data/models/bike_model.dart';
import 'package:cyclemind_ai/features/bikes/data/models/maintenance_log_model.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/maintenance_log.dart';
import 'package:cyclemind_ai/features/rides/data/models/ride_model.dart';
import 'package:cyclemind_ai/features/rides/domain/entities/ride.dart';
import 'package:flutter_test/flutter_test.dart';

/// Drift guard: the Dart half of G1 in firestore-tests/rules.test.js.
///
/// firestore.rules enforces EXACT key allowlists (`keysAre`). A toMap() that
/// gains, loses or renames a key makes every write of that type fail with an
/// opaque permission error, in production only, because the mock never runs
/// the rules. These sets must match `ALLOWED` in firestore-tests/fixtures.js.
///
/// Optional fields must be PRESENT-with-null, never absent: the rules'
/// `hasAll` half of keysAre requires every key on every write.
Set<String> _keys(Map<String, dynamic> m) => m.keys.toSet();

void main() {
  test('users', () {
    final m = UserModel.toMap(const AppUser(
      id: 'u1',
      email: 'a@example.com',
      profile: UserProfile(displayName: 'A'),
    ));
    expect(_keys(m), {'email', 'profile', 'goals', 'preferences'});
    expect(_keys(m['profile'] as Map<String, dynamic>),
        {'displayName', 'level', 'avatarUrl', 'weightKg'});
    expect(_keys(m['preferences'] as Map<String, dynamic>),
        {'metricUnits', 'darkMode', 'notificationsEnabled'});
  });

  test('bikes, and the component entries inside them', () {
    const bike = Bike(
      id: 'b1',
      userId: 'u1',
      name: 'Roadie',
      frame: 'f',
      groupset: 'g',
      tires: 't',
      components: [
        BikeComponent(
            id: 'c1', type: 'Chain', brand: '', installedAtKm: 0, lifespanKm: 1),
      ],
    );
    final m = BikeModel.toMap(bike);
    expect(_keys(m), {
      'userId', 'name', 'frame', 'groupset', 'tires',
      'totalMileageKm', 'imageUrl', 'components',
    });
    expect(_keys(BikeModel.componentsToMaps(bike.components).single),
        {'id', 'type', 'brand', 'installedAtKm', 'lifespanKm'});
  });

  test('rides (an unattributed ride still writes bikeId: null)', () {
    final m = RideModel.toMap(Ride(
      id: 'r1',
      userId: 'u1',
      startedAt: DateTime(2026),
      distanceKm: 10,
      elevationM: 0,
      avgSpeedKmh: 20,
      durationSec: 1800,
      calories: 100,
    ));
    expect(_keys(m), {
      'userId', 'bikeId', 'title', 'startedAt', 'distance', 'elevation',
      'avgSpeed', 'durationSec', 'calories', 'cadence', 'heartRate', 'power',
      'odometerDeltaKm',
    });
    expect(m['bikeId'], isNull);
  });

  test('maintenance_logs: the shape "Mark replaced" now writes', () {
    final m = MaintenanceLogModel.toMap(MaintenanceLog(
      id: 'l1',
      userId: 'u1',
      bikeId: 'b1',
      component: 'Chain',
      mileageAtService: 4262.4,
      status: MaintenanceStatus.dueSoon,
      serviceDate: DateTime(2026, 11, 9),
    ));
    expect(_keys(m), {
      'userId', 'bikeId', 'component', 'mileageAtService', 'status',
      'serviceDate', 'notes',
    });
    // The rules check `d.status in ['ok','dueSoon','overdue']` and
    // `d.serviceDate is timestamp`.
    expect(m['status'], 'dueSoon');
    expect(m['serviceDate'], isA<Timestamp>());
  });

  test('ai_reports', () {
    final m = ReportModel.toMap(BikeHealthReport(
      id: 'p1',
      userId: 'u1',
      healthScore: 80,
      riskLevel: RiskLevel.low,
      findings: const [],
      createdAt: DateTime(2026),
    ));
    expect(_keys(m), {
      'userId', 'bikeId', 'type', 'imageUrl', 'healthScore', 'riskLevel',
      'summary', 'recommendations', 'createdAt',
    });
  });
}
