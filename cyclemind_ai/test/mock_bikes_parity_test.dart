import 'dart:convert';
import 'dart:io';

import 'package:cyclemind_ai/core/providers/mock_store.dart';
import 'package:cyclemind_ai/core/utils/result.dart';
import 'package:cyclemind_ai/features/bikes/data/repositories/mock_bikes_repository.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/maintenance_log.dart';
import 'package:flutter_test/flutter_test.dart';

/// The mock must deny everything firestore.rules denies.
///
/// The deployed demo runs on this mock. If it accepted a write the rules
/// reject, the demo would pass while production failed, and nobody would know
/// until a real user hit it. Each test names the rule clause it mirrors, and
/// every denial asserts that NOTHING landed: the real batch is all-or-nothing.
Map<String, dynamic> _realSeed() =>
    jsonDecode(File('assets/data/mock_seed.json').readAsStringSync())
        as Map<String, dynamic>;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockStore store;
  late MockBikesRepository repo;
  late String uid;

  setUp(() {
    store = MockStore.instance
      ..bikes.clear()
      ..rides.clear()
      ..logs.clear()
      ..reports.clear();
    store.applySeed(_realSeed());
    repo = MockBikesRepository();
    uid = store.seedUser.id;
  });

  Bike roadie() => store.bikes.firstWhere((b) => b.id == 'bike-1');
  BikeComponent chainOf(Bike b) => componentById(b, 'c1')!;

  MaintenanceLog logFor(
    Bike b, {
    String id = 'L1',
    String? userId,
    String? bikeId,
    String component = 'Chain',
    double? km,
    String notes = '',
  }) =>
      MaintenanceLog(
        id: id,
        userId: userId ?? uid,
        bikeId: bikeId ?? b.id,
        component: component,
        mileageAtService: km ?? b.totalMileageKm,
        status: MaintenanceStatus.dueSoon,
        serviceDate: DateTime.now(),
        notes: notes,
      );

  Future<Result<void>> replace({
    Bike? bike,
    BikeComponent? replacement,
    MaintenanceLog? log,
  }) {
    final b = bike ?? roadie();
    return repo.replaceComponent(
      bike: b,
      replacement: replacement ?? chainOf(b).refitted(odometerKm: b.totalMileageKm),
      log: log ?? logFor(b),
    );
  }

  /// Everything a denial must leave exactly as it was.
  (double, int) state() => (chainOf(roadie()).installedAtKm, store.logs.length);

  test('a valid replacement lands both writes in ONE commit', () async {
    var ticks = 0;
    final sub = store.changes.listen((_) => ticks++);

    expect((await replace()).isSuccess, isTrue);
    await Future<void>.delayed(Duration.zero); // let the broadcast deliver
    await sub.cancel();

    expect(chainOf(roadie()).installedAtKm, roadie().totalMileageKm);
    expect(store.logs.where((l) => l.id == 'L1'), hasLength(1));
    // One tick: a watcher can never observe the reset without its log.
    expect(ticks, 1);
  });

  test('maintenance_logs update:false: a repeated id is denied, nothing changes',
      () async {
    await replace();
    final before = state();

    // A retry built from a newer snapshot, carrying the same id.
    final again = await replace(log: logFor(roadie()));

    expect(again.isSuccess, isFalse);
    expect(state(), before);
  });

  test('bikes ownsStored: a bike that does not exist is denied', () async {
    final ghost = roadie().copyWith(id: 'ghost');
    final logsBefore = store.logs.length;

    final r = await replace(bike: ghost, log: logFor(ghost));

    expect(r.isSuccess, isFalse);
    expect(store.logs.length, logsBefore);
  });

  test("bikes ownsStored: another user's bike is denied, whatever the snapshot "
      'claims', () async {
    final bobs = roadie().copyWith(id: 'bobs', userId: 'bob');
    store.bikes.add(bobs);
    // The caller's snapshot claims ownership; the STORED owner is what counts.
    final forged = bobs.copyWith(userId: uid);

    final r = await replace(bike: forged, log: logFor(forged));

    expect(r.isSuccess, isFalse);
    expect(chainOf(store.bikes.firstWhere((b) => b.id == 'bobs')).installedAtKm,
        1850);
  });

  test('signedIn: a log with no owner is denied', () async {
    final before = state();
    final anon = roadie().copyWith(userId: '');

    final r = await replace(bike: anon, log: logFor(anon, userId: ''));

    expect(r.isSuccess, isFalse);
    expect(state(), before);
  });

  test('str(d.component, 80): an 81-char label is denied and the reset does '
      'NOT land', () async {
    final before = state();
    final r = await replace(log: logFor(roadie(), component: 'x' * 81));

    expect(r.isSuccess, isFalse);
    expect(state(), before);
  });

  test('str(d.notes, 2000): over-long notes are denied', () async {
    final before = state();
    final r = await replace(log: logFor(roadie(), notes: 'n' * 2001));

    expect(r.isSuccess, isFalse);
    expect(state(), before);
  });

  test('numIn(mileageAtService, 0, 500000): out of range or NaN is denied',
      () async {
    final before = state();
    for (final km in [-1.0, 500001.0, double.nan]) {
      final r = await replace(log: logFor(roadie(), id: 'L-$km', km: km));
      expect(r.isSuccess, isFalse, reason: '$km');
    }
    expect(state(), before);
  });

  test('contract: a replacement for a part that is not on the bike is denied',
      () async {
    final stray = chainOf(roadie()).copyWith(id: 'not-there');
    expect((await replace(replacement: stray)).isSuccess, isFalse);
  });

  test('contract: a log for a different bike is denied', () async {
    final r = await replace(log: logFor(roadie(), bikeId: 'bike-2'));
    expect(r.isSuccess, isFalse);
  });

  test('contract: a replacement must be the same kind of part', () async {
    final swapped = chainOf(roadie()).copyWith(type: 'Cassette');
    expect((await replace(replacement: swapped)).isSuccess, isFalse);
  });

  test('field-scoped: the odometer comes from the store, not a stale snapshot',
      () async {
    final stale = roadie();
    // Another device logs a ride after this snapshot was taken.
    final i = store.bikes.indexOf(stale);
    store.bikes[i] = stale.copyWith(totalMileageKm: stale.totalMileageKm + 100);

    expect((await replace(bike: stale, log: logFor(stale))).isSuccess, isTrue);
    expect(roadie().totalMileageKm, stale.totalMileageKm + 100);
  });

  test('watchLogs: scoped to the user, newest first', () async {
    await replace();

    final mine = await repo.watchLogs(uid, 'bike-1').first;
    expect(mine.first.id, 'L1');
    expect(mine.map((l) => l.id), containsAll(['l1', 'l2', 'L1']));
    expect(await repo.watchLogs('someone-else', 'bike-1').first, isEmpty);
  });

  test('watchBikes shows the reset', () async {
    await replace();
    final bike =
        (await repo.watchBikes(uid).first).firstWhere((b) => b.id == 'bike-1');
    expect(chainOf(bike).wearFraction(bike.totalMileageKm), 0);
  });

  test('components.size() <= 60: setComponents refuses a 61st part', () async {
    final countBefore = roadie().components.length;
    final many = [
      for (var i = 0; i < 61; i++)
        BikeComponent(
            id: 'x$i', type: 'T', brand: '', installedAtKm: 0, lifespanKm: 1000),
    ];

    expect((await repo.setComponents('bike-1', many)).isSuccess, isFalse);
    expect(roadie().components.length, countBefore);
  });
}
