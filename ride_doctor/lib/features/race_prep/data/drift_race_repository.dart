import 'package:drift/drift.dart';
import 'package:ride_doctor/core/database/app_database.dart';
import 'package:ride_doctor/core/database/enum_text.dart';
import 'package:ride_doctor/features/race_prep/domain/race_checklist.dart';
import 'package:ride_doctor/features/race_prep/domain/race_debrief.dart';
import 'package:ride_doctor/features/race_prep/domain/race_event.dart';
import 'package:ride_doctor/features/race_prep/domain/race_repository.dart';

final class DriftRaceRepository implements RaceRepository {
  const new(this._db, {required this.clock, required this.newId});

  final AppDatabase _db;
  final DateTime Function() clock;
  final String Function() newId;

  @override
  Stream<List<RaceEvent>> watchRaces() {
    // ISO-8601 text sorts in time order, so the database can do the sorting.
    final query = _db.select(_db.raceEvents)
      ..orderBy([(row) => OrderingTerm.asc(row.startsAtLocal)]);
    return query.watch().map((rows) => rows.map(_toDomain).toList());
  }

  @override
  Stream<RaceEvent?> watchRace(String id) =>
      (_db.select(_db.raceEvents)..where((row) => row.id.equals(id)))
          .watchSingleOrNull()
          .map((row) => row == null ? null : _toDomain(row));

  @override
  Future<void> saveRace(RaceEvent race) async {
    final now = clock();
    final values = RaceEventsCompanion(
      name: Value(race.name),
      raceType: Value(race.type.name),
      startsAtLocal: Value(_wallTime(race.startsAt)),
      location: Value(race.location),
      distanceKm: Value(race.distanceKm),
      durationMinutes: Value(race.durationMinutes),
      laps: Value(race.laps),
      lapLengthKm: Value(race.lapLengthKm),
      cornerCount: Value(race.cornerCount),
      elevationGainM: Value(race.elevationGainM),
      category: Value(race.category),
      rulesNotes: Value(race.rulesNotes),
      travelMinutes: Value(race.travelMinutes),
      reconAllowed: Value(race.reconAllowed),
      updatedAt: Value(now),
    );
    await _db.transaction(() async {
      final updated = await (_db.update(
        _db.raceEvents,
      )..where((row) => row.id.equals(race.id))).write(values);
      if (updated == 0) {
        await _db
            .into(_db.raceEvents)
            .insert(values.copyWith(id: Value(race.id), createdAt: Value(now)));
      }
    });
  }

  @override
  Future<void> deleteRace(String id) =>
      (_db.delete(_db.raceEvents)..where((row) => row.id.equals(id))).go();

  @override
  Stream<Set<ChecklistItem>> watchChecked(String raceId) =>
      (_db.select(_db.raceChecklistItems)..where(
            (row) => row.raceId.equals(raceId) & row.checked.equals(true),
          ))
          .watch()
          .map(
            (rows) => {
              for (final row in rows)
                ?enumFromName(ChecklistItem.values, row.item),
            },
          );

  @override
  Future<void> setChecked(
    String raceId,
    ChecklistItem item, {
    required bool checked,
  }) {
    final now = clock();
    return _db
        .into(_db.raceChecklistItems)
        .insert(
          RaceChecklistItemsCompanion.insert(
            id: newId(),
            createdAt: now,
            updatedAt: now,
            raceId: raceId,
            item: item.name,
            checked: checked,
          ),
          onConflict: DoUpdate(
            (old) => RaceChecklistItemsCompanion(
              checked: Value(checked),
              updatedAt: Value(now),
            ),
            target: [
              _db.raceChecklistItems.raceId,
              _db.raceChecklistItems.item,
            ],
          ),
        );
  }

  @override
  Future<void> resetChecklist(String raceId) => (_db.delete(
    _db.raceChecklistItems,
  )..where((row) => row.raceId.equals(raceId))).go();

  @override
  Stream<Map<String, RaceDebrief>> watchDebriefs() => _db
      .select(_db.raceDebriefs)
      .watch()
      .map((rows) => {for (final row in rows) row.raceId: _debrief(row)});

  @override
  Future<void> saveDebrief(RaceDebrief debrief) {
    final now = clock();
    String names(Iterable<Enum> values) =>
        values.map((value) => value.name).join(',');
    final values = RaceDebriefsCompanion(
      finished: Value(debrief.finished),
      placing: Value(debrief.placing),
      fieldSize: Value(debrief.fieldSize),
      droppedWhen: Value(debrief.droppedWhen.name),
      struggles: Value(names(debrief.struggles)),
      symptoms: Value(names(debrief.symptoms)),
      wouldChange: Value(debrief.wouldChange),
      updatedAt: Value(now),
    );
    return _db
        .into(_db.raceDebriefs)
        .insert(
          values.copyWith(
            id: Value(newId()),
            createdAt: Value(debrief.recordedAt),
            raceId: Value(debrief.raceId),
          ),
          onConflict: DoUpdate(
            (old) => values,
            target: [_db.raceDebriefs.raceId],
          ),
        );
  }

  /// "2027-03-14T06:30:00.000": the local date and time with no zone marker.
  static String _wallTime(DateTime time) => DateTime(
    time.year,
    time.month,
    time.day,
    time.hour,
    time.minute,
  ).toIso8601String();

  RaceEvent _toDomain(RaceEventRow row) => RaceEvent(
    id: row.id,
    name: row.name,
    type: enumFromName(RaceType.values, row.raceType) ?? RaceType.roadRace,
    startsAt: DateTime.parse(row.startsAtLocal),
    location: row.location,
    distanceKm: row.distanceKm,
    durationMinutes: row.durationMinutes,
    laps: row.laps,
    lapLengthKm: row.lapLengthKm,
    cornerCount: row.cornerCount,
    elevationGainM: row.elevationGainM,
    category: row.category,
    rulesNotes: row.rulesNotes,
    travelMinutes: row.travelMinutes,
    reconAllowed: row.reconAllowed,
  );

  RaceDebrief _debrief(RaceDebriefRow row) {
    Set<T> parse<T extends Enum>(List<T> values, String text) => {
      for (final name in text.split(',')) ?enumFromName(values, name),
    };
    return RaceDebrief(
      raceId: row.raceId,
      finished: row.finished,
      placing: row.placing,
      fieldSize: row.fieldSize,
      droppedWhen:
          enumFromName(DroppedWhen.values, row.droppedWhen) ??
          DroppedWhen.notDropped,
      struggles: parse(StruggleArea.values, row.struggles),
      symptoms: parse(RaceSymptom.values, row.symptoms),
      wouldChange: row.wouldChange,
      recordedAt: row.createdAt,
    );
  }
}
