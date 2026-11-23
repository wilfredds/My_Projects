import 'package:ride_doctor/core/app/environment.dart';
import 'package:ride_doctor/core/database/database_providers.dart';
import 'package:ride_doctor/features/onboarding/data/drift_onboarding_repositories.dart';
import 'package:ride_doctor/features/onboarding/domain/consent.dart';
import 'package:ride_doctor/features/onboarding/domain/onboarding_repositories.dart';
import 'package:ride_doctor/features/onboarding/domain/readiness.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'onboarding_providers.g.dart';

@Riverpod(keepAlive: true)
Future<ReadinessRepository> readinessRepository(Ref ref) async =>
    DriftReadinessRepository(
      await ref.watch(appDatabaseProvider.future),
      newId: ref.watch(idGeneratorProvider),
    );

@Riverpod(keepAlive: true)
Future<ConsentRepository> consentRepository(Ref ref) async =>
    DriftConsentRepository(
      await ref.watch(appDatabaseProvider.future),
      clock: ref.watch(clockProvider),
      newId: ref.watch(idGeneratorProvider),
    );

@Riverpod(keepAlive: true)
Stream<ReadinessScreening?> latestReadiness(Ref ref) async* {
  final repository = await ref.watch(readinessRepositoryProvider.future);
  yield* repository.watchLatest();
}

@Riverpod(keepAlive: true)
Stream<Map<ConsentKind, bool>> currentConsents(Ref ref) async* {
  final repository = await ref.watch(consentRepositoryProvider.future);
  yield* repository.watchCurrent();
}
