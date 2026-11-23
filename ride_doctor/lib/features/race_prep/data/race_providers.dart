import 'package:ride_doctor/core/app/environment.dart';
import 'package:ride_doctor/core/database/database_providers.dart';
import 'package:ride_doctor/features/race_prep/data/drift_race_repository.dart';
import 'package:ride_doctor/features/race_prep/domain/race_checklist.dart';
import 'package:ride_doctor/features/race_prep/domain/race_debrief.dart';
import 'package:ride_doctor/features/race_prep/domain/race_event.dart';
import 'package:ride_doctor/features/race_prep/domain/race_repository.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'race_providers.g.dart';

@Riverpod(keepAlive: true)
Future<RaceRepository> raceRepository(Ref ref) async => DriftRaceRepository(
  await ref.watch(appDatabaseProvider.future),
  clock: ref.watch(clockProvider),
  newId: ref.watch(idGeneratorProvider),
);

@Riverpod(keepAlive: true)
Stream<List<RaceEvent>> races(Ref ref) async* {
  final repository = await ref.watch(raceRepositoryProvider.future);
  yield* repository.watchRaces();
}

@Riverpod(keepAlive: true)
Stream<Map<String, RaceDebrief>> raceDebriefs(Ref ref) async* {
  final repository = await ref.watch(raceRepositoryProvider.future);
  yield* repository.watchDebriefs();
}

@riverpod
Stream<RaceEvent?> race(Ref ref, String id) async* {
  final repository = await ref.watch(raceRepositoryProvider.future);
  yield* repository.watchRace(id);
}

@riverpod
Stream<Set<ChecklistItem>> checkedItems(Ref ref, String raceId) async* {
  final repository = await ref.watch(raceRepositoryProvider.future);
  yield* repository.watchChecked(raceId);
}
