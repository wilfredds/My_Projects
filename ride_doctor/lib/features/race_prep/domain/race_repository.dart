import 'package:ride_doctor/features/race_prep/domain/race_checklist.dart';
import 'package:ride_doctor/features/race_prep/domain/race_debrief.dart';
import 'package:ride_doctor/features/race_prep/domain/race_event.dart';

/// Stores races, their checklists and their debriefs.
abstract interface class RaceRepository {
  /// Every race, earliest start first.
  Stream<List<RaceEvent>> watchRaces();

  Stream<RaceEvent?> watchRace(String id);

  /// Inserts or updates [race] by id.
  Future<void> saveRace(RaceEvent race);

  /// Deletes the race together with its checklist and debrief.
  Future<void> deleteRace(String id);

  /// The items ticked for this race.
  Stream<Set<ChecklistItem>> watchChecked(String raceId);

  Future<void> setChecked(
    String raceId,
    ChecklistItem item, {
    required bool checked,
  });

  /// Unticks everything, ready to use the list again.
  Future<void> resetChecklist(String raceId);

  /// Every debrief, keyed by race id.
  Stream<Map<String, RaceDebrief>> watchDebriefs();

  /// Saves the debrief for its race, replacing any earlier one.
  Future<void> saveDebrief(RaceDebrief debrief);
}
