import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/core/database/app_database.dart';
import 'package:ride_doctor/features/onboarding/data/drift_onboarding_repositories.dart';
import 'package:ride_doctor/features/onboarding/domain/consent.dart';
import 'package:ride_doctor/features/onboarding/domain/readiness.dart';

import '../../helpers/test_database.dart';

Map<ReadinessQuestion, bool> allNo() => {
  for (final question in ReadinessQuestion.values) question: false,
};

void main() {
  late AppDatabase database;
  late FakeClock clock;

  setUp(() {
    database = newTestDatabase();
    clock = FakeClock();
  });

  tearDown(() => database.close());

  group('ReadinessScreening', () {
    test('anyYes is false when every answer is no', () {
      final screening = ReadinessScreening(
        answers: allNo(),
        questionnaireVersion: 1,
        completedAt: clock.now,
      );
      expect(screening.anyYes, isFalse);
      expect(screening.isComplete, isTrue);
    });

    test('a single yes sets anyYes', () {
      final screening = ReadinessScreening(
        answers: {...allNo(), ReadinessQuestion.chestPain: true},
        questionnaireVersion: 1,
        completedAt: clock.now,
      );
      expect(screening.anyYes, isTrue);
    });

    test('is incomplete until every question is answered', () {
      final screening = ReadinessScreening(
        answers: {ReadinessQuestion.chestPain: false},
        questionnaireVersion: 1,
        completedAt: clock.now,
      );
      expect(screening.isComplete, isFalse);
    });
  });

  group('DriftReadinessRepository', () {
    late DriftReadinessRepository repository;

    setUp(() {
      repository = DriftReadinessRepository(database, newId: sequentialIds());
    });

    test('nothing before the first screening', () async {
      expect(await repository.watchLatest().first, isNull);
    });

    test('a screening round-trips with its answers and version', () async {
      final screening = ReadinessScreening(
        answers: {...allNo(), ReadinessQuestion.boneOrJointProblem: true},
        questionnaireVersion: readinessQuestionnaireVersion,
        completedAt: clock.now,
      );
      await repository.save(screening);

      expect(await repository.watchLatest().first, screening);
      final row = await database
          .select(database.readinessScreenings)
          .getSingle();
      expect(row.anyYes, isTrue);
    });

    test('retaking keeps the history and returns the newest', () async {
      await repository.save(
        ReadinessScreening(
          answers: {...allNo(), ReadinessQuestion.chestPain: true},
          questionnaireVersion: 1,
          completedAt: clock.now,
        ),
      );
      clock.advance(const Duration(days: 30));
      await repository.save(
        ReadinessScreening(
          answers: allNo(),
          questionnaireVersion: 1,
          completedAt: clock.now,
        ),
      );

      expect((await repository.watchLatest().first)!.anyYes, isFalse);
      expect(
        await database.select(database.readinessScreenings).get(),
        hasLength(2),
      );
    });
  });

  group('DriftConsentRepository', () {
    late DriftConsentRepository repository;

    setUp(() {
      repository = DriftConsentRepository(
        database,
        clock: clock.call,
        newId: sequentialIds(),
      );
    });

    test('nothing is consented to by default', () async {
      expect(await repository.watchCurrent().first, {
        ConsentKind.healthData: false,
        ConsentKind.location: false,
        ConsentKind.notifications: false,
      });
    });

    test('each kind is recorded independently', () async {
      await repository.record(ConsentKind.healthData, granted: true);
      await repository.record(ConsentKind.notifications, granted: false);

      expect(await repository.watchCurrent().first, {
        ConsentKind.healthData: true,
        ConsentKind.location: false,
        ConsentKind.notifications: false,
      });
    });

    test('withdrawing appends a record instead of rewriting history', () async {
      await repository.record(ConsentKind.location, granted: true);
      clock.advance(const Duration(days: 2));
      await repository.record(ConsentKind.location, granted: false);

      expect(
        (await repository.watchCurrent().first)[ConsentKind.location],
        isFalse,
      );
      final history = await repository.history();
      expect(history, hasLength(2));
      expect(history.first.granted, isTrue);
      expect(history.first.recordedAt, DateTime.utc(2026, 11, 23, 8));
      expect(history.last.granted, isFalse);
      expect(history.last.recordedAt, DateTime.utc(2026, 11, 25, 8));
      expect(history.last.policyVersion, consentPolicyVersion);
    });

    test('two changes in the same instant resolve to the later one', () async {
      await repository.record(ConsentKind.location, granted: true);
      await repository.record(ConsentKind.location, granted: false);
      await repository.record(ConsentKind.location, granted: true);

      expect(
        (await repository.watchCurrent().first)[ConsentKind.location],
        isTrue,
      );
    });
  });
}
