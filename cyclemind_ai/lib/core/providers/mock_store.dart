import 'dart:convert';

import 'package:cyclemind_ai/core/constants/app_constants.dart';
import 'package:cyclemind_ai/features/auth/domain/entities/app_user.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/maintenance_log.dart';
import 'package:cyclemind_ai/features/rides/domain/entities/ride.dart';
import 'package:flutter/services.dart' show rootBundle;

/// In-memory data store backing every *mock* data source.
///
/// Loaded once from `assets/data/mock_seed.json`, then held in memory for the
/// app session so that adds/edits persist while exploring (USE_MOCKS=true).
/// A single shared instance is exposed via [MockStore.instance].
class MockStore {
  MockStore._();
  static final MockStore instance = MockStore._();

  bool _loaded = false;
  AppUser? _user;
  final List<Bike> bikes = [];
  final List<Ride> rides = [];
  final List<MaintenanceLog> logs = [];

  AppUser get user => _user!;
  set user(AppUser u) => _user = u;

  Future<void> ensureLoaded() async {
    if (_loaded) return;
    _loaded = true;
    Map<String, dynamic> seed;
    try {
      seed = jsonDecode(await rootBundle.loadString(AppConstants.mockSeedAsset))
          as Map<String, dynamic>;
    } catch (_) {
      seed = const {};
    }

    final u = (seed['user'] as Map<String, dynamic>?) ?? const {};
    _user = AppUser(
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

    for (final b in (seed['bikes'] as List?) ?? const []) {
      final m = b as Map<String, dynamic>;
      bikes.add(Bike(
        id: m['id'] as String,
        userId: _user!.id,
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
        userId: _user!.id,
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
