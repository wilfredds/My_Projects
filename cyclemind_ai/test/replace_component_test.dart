import 'package:cyclemind_ai/core/constants/app_constants.dart';
import 'package:cyclemind_ai/core/error/failures.dart';
import 'package:cyclemind_ai/core/utils/result.dart';
import 'package:cyclemind_ai/core/utils/write_ack.dart';
import 'package:cyclemind_ai/features/bikes/domain/component_validation.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/maintenance_log.dart';
import 'package:cyclemind_ai/features/bikes/domain/repositories/bikes_repository.dart';
import 'package:cyclemind_ai/features/bikes/domain/usecases/generate_reminders.dart';
import 'package:cyclemind_ai/features/bikes/domain/usecases/replace_component.dart';
import 'package:flutter_test/flutter_test.dart';

/// Applies a replacement the way the real repositories do, and reproduces the
/// rules' denial of a repeated log id (maintenance_logs update is denied).
class _FakeBikes implements BikesRepository {
  _FakeBikes(List<Bike> bikes, {this.failWith, this.ack = WriteAck.confirmed})
      : bikes = [...bikes];

  List<Bike> bikes;
  final AppFailure? failWith;

  /// What a successful save reports: queued is what offline looks like.
  final WriteAck ack;
  final List<MaintenanceLog> logs = [];

  /// How many times a write was attempted at all.
  int calls = 0;

  @override
  Future<Result<WriteAck>> replaceComponent({
    required Bike bike,
    required BikeComponent replacement,
    required MaintenanceLog log,
  }) async {
    calls++;
    if (failWith != null) return Failure(failWith!);
    final violation = replacementContractViolation(
        bike: bike, replacement: replacement, log: log);
    if (violation != null) return Failure(ValidationFailure(violation));
    if (logs.any((l) => l.id == log.id)) {
      return Failure(const ValidationFailure('already recorded'));
    }
    bikes = [
      for (final b in bikes)
        b.id == bike.id
            ? b.copyWith(components: replaceById(bike.components, replacement))
            : b
    ];
    logs.add(log);
    return Success(ack);
  }

  @override
  Stream<List<Bike>> watchBikes(String userId) => Stream.value(bikes);
  @override
  Future<Result<WriteAck>> addBike(Bike bike) async =>
      const Success(WriteAck.confirmed);
  @override
  Future<Result<WriteAck>> setComponents(
          String bikeId, List<BikeComponent> components) async =>
      throw UnimplementedError();
  @override
  Future<Result<void>> deleteBike(String bikeId) async => const Success(null);
  @override
  Stream<List<MaintenanceLog>> watchLogs(String userId, String bikeId) =>
      Stream.value(logs);
}

/// The seeded demo bike after one 62.4 km ride: the chain is at 80.4%.
const _odo = 4262.4;

const _cassette = BikeComponent(
  id: 'c2',
  type: 'Cassette',
  brand: 'Shimano',
  installedAtKm: 0,
  lifespanKm: 9000,
);

BikeComponent _chain({
  double installedAt = 1850,
  double lifespan = 3000,
  String type = 'Chain',
  String brand = 'Shimano',
}) =>
    BikeComponent(
      id: 'c1',
      type: type,
      brand: brand,
      installedAtKm: installedAt,
      lifespanKm: lifespan,
    );

Bike _bike({double km = _odo, List<BikeComponent>? components}) => Bike(
      id: 'b1',
      userId: 'u1',
      name: 'Roadie',
      frame: 'f',
      groupset: 'g',
      tires: 't',
      totalMileageKm: km,
      components: components ?? [_chain(), _cassette],
    );

Future<Result<ComponentReplaced>> _replace(
  _FakeBikes repo, {
  Bike? bike,
  String componentId = 'c1',
  String logId = 'log-1',
  String userId = 'u1',
  String brand = 'KMC',
  double lifespanKm = 3000,
  String note = '',
}) =>
    ReplaceComponent(repo).call(
      logId: logId,
      userId: userId,
      bike: bike ?? repo.bikes.first,
      componentId: componentId,
      brand: brand,
      lifespanKm: lifespanKm,
      note: note,
      serviceDate: DateTime(2026, 11, 9),
    );

void main() {
  const generate = GenerateReminders();

  group('Mark replaced resets wear', () {
    test('THE BUG: a due chain stops reminding once it is replaced', () async {
      final repo = _FakeBikes([_bike()]);
      expect(generate.call(repo.bikes).map((r) => r.component.id),
          contains('c1'));

      await _replace(repo);

      expect(generate.call(repo.bikes), isEmpty);
    });

    test('the part reads 0% at the current odometer; id and type are kept',
        () async {
      final repo = _FakeBikes([_bike()]);
      expect((await _replace(repo)).isSuccess, isTrue);

      final c = componentById(repo.bikes.single, 'c1')!;
      expect(c.installedAtKm, _odo);
      expect(c.wearFraction(_odo), 0);
      expect(c.type, 'Chain');
    });

    test('only that part changes, in place, and the odometer is untouched',
        () async {
      final repo = _FakeBikes([_bike()]);
      await _replace(repo);

      final b = repo.bikes.single;
      expect(b.totalMileageKm, _odo);
      expect(componentById(b, 'c2'), _cassette);
      expect(b.components.map((c) => c.id), ['c1', 'c2']);
    });

    test('a new brand and lifespan are applied (trimmed)', () async {
      final repo = _FakeBikes([_bike()]);
      await _replace(repo, brand: '  KMC X11  ', lifespanKm: 2500);

      final c = componentById(repo.bikes.single, 'c1')!;
      expect(c.brand, 'KMC X11');
      expect(c.lifespanKm, 2500);
    });
  });

  group('the service-history entry', () {
    test("records the REMOVED part's status, not the new part's", () async {
      for (final (used, status) in [
        (300.0, MaintenanceStatus.ok),
        (2550.0, MaintenanceStatus.dueSoon),
        (3600.0, MaintenanceStatus.overdue),
      ]) {
        final repo =
            _FakeBikes([_bike(components: [_chain(installedAt: _odo - used)])]);
        await _replace(repo);
        expect(repo.logs.single.status, status,
            reason: '$used km on a 3000 km part');
      }
    });

    test('names the bike, owner, part, odometer and date', () async {
      final repo = _FakeBikes([_bike()]);
      await _replace(repo);

      final log = repo.logs.single;
      expect(log.id, 'log-1');
      expect(log.bikeId, 'b1');
      expect(log.userId, 'u1');
      expect(log.component, 'Chain');
      expect(log.mileageAtService, _odo);
      expect(log.serviceDate, DateTime(2026, 11, 9));
    });

    test("notes say what came off and what went on, then the rider's note",
        () async {
      final repo = _FakeBikes([_bike()]);
      await _replace(repo, note: '  Fitted at Velo shop  ');

      expect(
        repo.logs.single.notes,
        'Removed Shimano after 2412 km (80% of 3000 km). '
        'Fitted KMC, lifespan 3000 km.\n\nFitted at Velo shop',
      );
    });

    test('labels are clipped to the rules limit, never mid-emoji', () {
      expect(logLabel('x' * 200).length, AppConstants.maxLogComponentChars);
      expect(logLabel('${'x' * 79}😀'), 'x' * 79);
      expect(logLabel('   '), 'Component');
    });

    test('a part with a long legacy type can still be replaced', () async {
      // Rejecting would make it impossible to EVER mark this part replaced:
      // every attempt would be denied by `str(d.component, 80)`.
      final repo = _FakeBikes([_bike(components: [_chain(type: 'x' * 200)])]);
      expect((await _replace(repo)).isSuccess, isTrue);
      expect(repo.logs.single.component.length,
          AppConstants.maxLogComponentChars);
    });

    test('a huge legacy brand cannot push notes past the rules limit',
        () async {
      final repo = _FakeBikes([_bike(components: [_chain(brand: 'b' * 5000)])]);
      final r = await _replace(repo,
          note: 'n' * AppConstants.maxServiceNoteChars);

      expect(r.isSuccess, isTrue);
      expect(repo.logs.single.notes.length,
          lessThanOrEqualTo(AppConstants.maxLogNotesChars));
    });

    test('a legacy NaN lifespan does not crash the summary', () async {
      // double.nan.round() throws. Unguarded, this would crash replacing
      // exactly the part most in need of it.
      final repo =
          _FakeBikes([_bike(components: [_chain(lifespan: double.nan)])]);
      expect((await _replace(repo)).isSuccess, isTrue);
      expect(repo.logs.single.notes,
          startsWith('Removed Shimano after 2412 km. Fitted KMC'));
    });
  });

  group('invalid input writes nothing', () {
    final cases = <String, Future<Result<ComponentReplaced>> Function(_FakeBikes)>{
      'lifespan 0': (r) => _replace(r, lifespanKm: 0),
      'lifespan negative': (r) => _replace(r, lifespanKm: -1),
      'lifespan NaN': (r) => _replace(r, lifespanKm: double.nan),
      'lifespan infinite': (r) => _replace(r, lifespanKm: double.infinity),
      'lifespan over the max': (r) =>
          _replace(r, lifespanKm: AppConstants.maxComponentLifespanKm + 1),
      'note too long': (r) =>
          _replace(r, note: 'n' * (AppConstants.maxServiceNoteChars + 1)),
      'no signed-in user': (r) => _replace(r, userId: ''),
      "someone else's bike": (r) => _replace(r, userId: 'intruder'),
      'unknown component': (r) => _replace(r, componentId: 'nope'),
      'empty replacement id': (r) => _replace(r, logId: ''),
      'corrupt odometer': (r) => _replace(r, bike: _bike(km: double.nan)),
    };

    for (final c in cases.entries) {
      test(c.key, () async {
        final repo = _FakeBikes([_bike()]);
        final r = await c.value(repo);

        expect(r.fold((f) => f, (_) => null), isA<ValidationFailure>());
        expect(repo.calls, 0);
        expect(repo.logs, isEmpty);
      });
    }
  });

  group('retries and failures', () {
    test('the same replacement id twice is recorded once', () async {
      final repo = _FakeBikes([_bike()]);
      expect((await _replace(repo)).isSuccess, isTrue);

      // What "Try again" sends: the SAME id, built from a newer snapshot.
      final again = await _replace(repo, bike: repo.bikes.single);

      expect(again.isSuccess, isFalse);
      expect(repo.logs, hasLength(1));
    });

    test('a failed save is reported, and nothing is claimed', () async {
      final repo = _FakeBikes([_bike()], failWith: const ServerFailure('x'));
      final r = await _replace(repo);

      expect(r.isSuccess, isFalse);
      expect(componentById(repo.bikes.single, 'c1')!.installedAtKm, 1850);
      expect(repo.logs, isEmpty);
    });

    test('the message says where it was recorded and when the next reminder is',
        () async {
      final r = (await _replace(_FakeBikes([_bike()]))).valueOrNull!;
      // 4262.4 + 0.8 x 3000 = 6662.4
      expect(replacementMessage(r),
          'Chain replaced at 4262 km. Next reminder around 6662 km.');
    });
  });

  group('offline', () {
    test('a replacement saved only on this device is reported as queued, and '
        'the message says it will sync', () async {
      final r =
          (await _replace(_FakeBikes([_bike()], ack: WriteAck.queued))).valueOrNull!;

      expect(r.queued, isTrue);
      expect(
        replacementMessage(r),
        'Chain replaced at 4262 km. Next reminder around 6662 km. '
        '$savedOfflineNote',
      );
    });
  });

  group('adding a part that has already been ridden', () {
    test('THE BUG: 2500 km on a 3000 km part is due soon straight away', () {
      final part = BikeComponent.fitted(
        id: 'c9',
        type: 'Cassette',
        brand: 'SRAM',
        lifespanKm: 3000,
        odometerKm: 4200,
        alreadyRiddenKm: 2500,
      );

      expect(part.installedAtKm, 1700);
      expect(part.wearFraction(4200), closeTo(0.833, 0.001));
      expect(generate.call([_bike(km: 4200, components: [part])]).single.status,
          MaintenanceStatus.dueSoon);
    });

    test('with nothing ridden, a new part starts at 0%', () {
      final part = BikeComponent.fitted(
          id: 'c9', type: 'Chain', brand: '', lifespanKm: 3000, odometerKm: 4200);
      expect(part.wearFraction(4200), 0);
    });

    test('a used part on a newer bike may sit below km 0; wear is still right',
        () {
      final part = BikeComponent.fitted(
        id: 'c9',
        type: 'Chain',
        brand: '',
        lifespanKm: 3000,
        odometerKm: 100,
        alreadyRiddenKm: 1500,
      );
      expect(part.installedAtKm, -1400);
      expect(part.usedKm(100), 1500);
    });
  });

  group('validators', () {
    test('parseFiniteKm refuses NaN, Infinity and junk', () {
      expect(parseFiniteKm('42'), 42);
      expect(parseFiniteKm(' 7.5 '), 7.5);
      for (final bad in ['NaN', 'Infinity', '-Infinity', 'abc', '', null]) {
        expect(parseFiniteKm(bad), isNull, reason: '$bad');
      }
    });

    test('lifespanError', () {
      for (final ok in [1.0, 3000.0, AppConstants.maxComponentLifespanKm]) {
        expect(lifespanError(ok), isNull, reason: '$ok');
      }
      for (final bad in <double?>[
        null,
        0,
        0.5,
        -1,
        double.nan,
        double.infinity,
        AppConstants.maxComponentLifespanKm + 1,
      ]) {
        expect(lifespanError(bad), isNotNull, reason: '$bad');
      }
    });

    test('alreadyRiddenError', () {
      for (final ok in [0.0, 2500.0, AppConstants.maxOdometerKm]) {
        expect(alreadyRiddenError(ok), isNull, reason: '$ok');
      }
      for (final bad in <double?>[
        null,
        -1,
        double.nan,
        AppConstants.maxOdometerKm + 1,
      ]) {
        expect(alreadyRiddenError(bad), isNotNull, reason: '$bad');
      }
    });
  });
}
