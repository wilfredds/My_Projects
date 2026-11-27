import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:ride_doctor/core/database/app_database.dart';
import 'package:ride_doctor/core/database/enum_text.dart';
import 'package:ride_doctor/features/onboarding/domain/consent.dart';
import 'package:ride_doctor/features/onboarding/domain/onboarding_repositories.dart';
import 'package:ride_doctor/features/onboarding/domain/readiness.dart';

final class DriftReadinessRepository implements ReadinessRepository {
  const new(this._db, {required this.newId});

  final AppDatabase _db;
  final String Function() newId;

  @override
  Stream<ReadinessScreening?> watchLatest() {
    final query = _db.select(_db.readinessScreenings)
      ..orderBy([(row) => OrderingTerm.desc(row.createdAt)])
      ..limit(1);
    return query.watchSingleOrNull().map(
      (row) => row == null ? null : _toDomain(row),
    );
  }

  @override
  Future<void> save(ReadinessScreening screening) => _db
      .into(_db.readinessScreenings)
      .insert(
        ReadinessScreeningsCompanion.insert(
          id: newId(),
          createdAt: screening.completedAt,
          updatedAt: screening.completedAt,
          questionnaireVersion: screening.questionnaireVersion,
          answersJson: jsonEncode({
            for (final MapEntry(:key, :value) in screening.answers.entries)
              key.name: value,
          }),
          anyYes: screening.anyYes,
        ),
      );

  ReadinessScreening _toDomain(ReadinessScreeningRow row) {
    final stored = jsonDecode(row.answersJson) as Map<String, dynamic>;
    return ReadinessScreening(
      answers: {
        for (final MapEntry(:key, :value) in stored.entries)
          ?enumFromName(ReadinessQuestion.values, key): value == true,
      },
      questionnaireVersion: row.questionnaireVersion,
      completedAt: row.createdAt,
    );
  }
}

final class DriftConsentRepository implements ConsentRepository {
  const new(this._db, {required this.clock, required this.newId});

  final AppDatabase _db;
  final DateTime Function() clock;
  final String Function() newId;

  SimpleSelectStatement<$ConsentRecordsTable, ConsentRecordRow>
  get _oldestFirst => _db.select(_db.consentRecords)
    ..orderBy([
      (row) => OrderingTerm.asc(row.createdAt),
      // Two records in the same instant keep their insertion order.
      (row) => OrderingTerm.asc(row.rowId),
    ]);

  @override
  Stream<Map<ConsentKind, bool>> watchCurrent() =>
      _oldestFirst.watch().map((rows) {
        final current = {for (final kind in ConsentKind.values) kind: false};
        // Oldest first, so a later record overwrites an earlier one. A "yes"
        // only counts if it was given to the current wording: agreeing to
        // "not used yet" is not agreeing to "sent to a weather service".
        for (final row in rows) {
          final kind = enumFromName(ConsentKind.values, row.kind);
          if (kind != null) {
            current[kind] =
                row.granted && row.policyVersion >= kind.currentPolicyVersion;
          }
        }
        return current;
      });

  @override
  Future<void> record(ConsentKind kind, {required bool granted}) {
    final now = clock();
    return _db
        .into(_db.consentRecords)
        .insert(
          ConsentRecordsCompanion.insert(
            id: newId(),
            createdAt: now,
            updatedAt: now,
            kind: kind.name,
            granted: granted,
            policyVersion: kind.currentPolicyVersion,
          ),
        );
  }

  @override
  Future<List<ConsentRecord>> history() async => [
    for (final row in await _oldestFirst.get())
      if (enumFromName(ConsentKind.values, row.kind) case final kind?)
        ConsentRecord(
          kind: kind,
          granted: row.granted,
          policyVersion: row.policyVersion,
          recordedAt: row.createdAt,
        ),
  ];
}
