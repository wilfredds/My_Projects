import 'dart:async';
import 'dart:convert';

import 'package:cyclemind_ai/core/constants/app_constants.dart';
import 'package:cyclemind_ai/features/auth/domain/entities/app_user.dart';
import 'package:cyclemind_ai/features/bike_doctor/domain/entities/bike_health_report.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/maintenance_log.dart';
import 'package:cyclemind_ai/features/rides/domain/entities/ride.dart';
import 'package:flutter/foundation.dart' show visibleForTesting;
import 'package:flutter/services.dart' show rootBundle;

/// In-memory data store backing every *mock* data source.
///
/// Loaded once from `assets/data/mock_seed.json`, then held in memory for the
/// app session so adds/edits persist while exploring (USE_MOCKS=true).
///
/// OWNERSHIP: rows carry a `userId` and every repository MUST filter on it.
/// This store is process-wide, so a repository that ignores its `userId`
/// argument shows one user another user's data — which is exactly the bug this
/// class was rewritten to close.
///
/// CHANGE NOTIFICATION: mutations go through [commit], which ticks [changes].
/// Repositories re-read and re-filter on each tick instead of owning private
/// StreamControllers. That is what lets a *ride* write update *bike* watchers
/// — the two are coupled by the odometer. It deliberately over-emits: a ride
/// write rebuilds bike widgets. At demo data sizes that is free, and it is far
/// cheaper than the alternative of repositories reaching into each other.
class MockStore {
  MockStore._();
  static final MockStore instance = MockStore._();

  bool _loaded = false;
  AppUser? _seedUser;

  final List<Bike> bikes = [];
  final List<Ride> rides = [];
  final List<MaintenanceLog> logs = [];
  final List<BikeHealthReport> reports = [];

  final _changes = StreamController<void>.broadcast();

  /// Ticks once after every committed mutation.
  Stream<void> get changes => _changes.stream;

  /// The seeded demo user. There is deliberately NO setter: identity belongs to
  /// the auth repository. A setter here let a signed-up user's profile edit
  /// overwrite the demo identity, so the next demo sign-in returned the wrong
  /// person.
  AppUser get seedUser => _seedUser!;

  /// Applies [mutate] and notifies every watcher.
  void commit(void Function(MockStore store) mutate) {
    mutate(this);
    _changes.add(null);
  }

  Future<void> ensureLoaded() async {
    if (_loaded) return;
    _loaded = true;
    applySeed(await _readSeedJson());
  }

  /// Drops every session mutation and restores the seeded demo data.
  ///
  /// Called on sign-out so a later sign-up cannot see the previous user's
  /// garage. The documented consequence: anything a mock user creates is lost
  /// on sign-out. That is the mock contract — the seed is the demo, and the
  /// alternative is the cross-user leak.
  Future<void> reset() async {
    bikes.clear();
    rides.clear();
    logs.clear();
    reports.clear();
    _seedUser = null;
    _loaded = false;
    await ensureLoaded();
    _changes.add(null);
  }

  Future<Map<String, dynamic>> _readSeedJson() async {
    try {
      return jsonDecode(await rootBundle.loadString(AppConstants.mockSeedAsset))
          as Map<String, dynamic>;
    } catch (_) {
      return const {};
    }
  }

  /// Parses [seed] into the store. Separated from asset loading so tests can
  /// feed the real seed file without a Flutter asset bundle.
  @visibleForTesting
  void applySeed(Map<String, dynamic> seed) {
    final u = (seed['user'] as Map<String, dynamic>?) ?? const {};
    final user = AppUser(
      id: u['id'] as String? ?? 'mock-user-1',
      email: u['email'] as String? ?? 'rider@cyclemind.ai',
      profile: UserProfile(
        displayName: u['displayName'] as String? ?? 'Rider',
        level: _level(u['level'] as String?),
        weightKg: (u['weightKg'] as num?)?.toDouble(),
      ),
      goals: ((u['goals'] as List?) ?? const [])
          .map((g) => _goal(g as String))
          .toList(),
    );
    _seedUser = user;
    _loaded = true;

    for (final b in (seed['bikes'] as List?) ?? const []) {
      final m = b as Map<String, dynamic>;
      bikes.add(Bike(
        id: m['id'] as String,
        userId: user.id,
        name: m['name'] as String,
        frame: m['frame'] as String,
        groupset: m['groupset'] as String,
        tires: m['tires'] as String,
        totalMileageKm: (m['totalMileageKm'] as num).toDouble(),
        components: ((m['components'] as List?) ?? const [])
            .map((c) => _component(c as Map<String, dynamic>))
            .toList(),
      ));
    }

    for (final r in (seed['rides'] as List?) ?? const []) {
      final m = r as Map<String, dynamic>;
      rides.add(Ride(
        id: m['id'] as String,
        userId: user.id,
        bikeId: m['bikeId'] as String?,
        title: m['title'] as String? ?? 'Ride',
        startedAt:
            DateTime.now().subtract(Duration(days: (m['daysAgo'] as num).toInt())),
        distanceKm: (m['distanceKm'] as num).toDouble(),
        elevationM: (m['elevationM'] as num).toDouble(),
        avgSpeedKmh: (m['avgSpeedKmh'] as num).toDouble(),
        durationSec: (m['durationSec'] as num).toInt(),
        calories: (m['calories'] as num).toInt(),
        cadence: (m['cadence'] as num?)?.toInt(),
        heartRate: (m['heartRate'] as num?)?.toInt(),
        power: (m['power'] as num?)?.toInt(),
        // Seeded rides predate odometer accounting: the seeded
        // `totalMileageKm` is a lump figure that ALREADY includes them.
        // Leaving this null is what stops deleting a seeded ride from
        // subtracting distance that was never added.
        odometerDeltaKm: null,
      ));
    }
    rides.sort((a, b) => b.startedAt.compareTo(a.startedAt));
  }

  BikeComponent _component(Map<String, dynamic> c) => BikeComponent(
        id: c['id'] as String,
        type: c['type'] as String,
        brand: c['brand'] as String,
        installedAtKm: (c['installedAtKm'] as num).toDouble(),
        lifespanKm: (c['lifespanKm'] as num).toDouble(),
      );

  RiderLevel _level(String? s) => RiderLevel.values
      .firstWhere((l) => l.name == s, orElse: () => RiderLevel.beginner);

  RiderGoal _goal(String s) => RiderGoal.values
      .firstWhere((g) => g.name == s, orElse: () => RiderGoal.improveEndurance);
}
