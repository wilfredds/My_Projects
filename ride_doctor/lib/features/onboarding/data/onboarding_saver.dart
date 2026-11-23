import 'package:ride_doctor/core/app/environment.dart';
import 'package:ride_doctor/core/database/app_database.dart';
import 'package:ride_doctor/core/database/database_providers.dart';
import 'package:ride_doctor/features/onboarding/data/onboarding_providers.dart';
import 'package:ride_doctor/features/onboarding/domain/consent.dart';
import 'package:ride_doctor/features/onboarding/domain/onboarding_repositories.dart';
import 'package:ride_doctor/features/onboarding/domain/readiness.dart';
import 'package:ride_doctor/features/profile/data/profile_providers.dart';
import 'package:ride_doctor/features/profile/domain/bike.dart';
import 'package:ride_doctor/features/profile/domain/garage_repository.dart';
import 'package:ride_doctor/features/profile/domain/rider_profile.dart';
import 'package:ride_doctor/features/profile/domain/rider_repository.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'onboarding_saver.g.dart';

/// Thrown when onboarding is saved without the health-data consent. The UI
/// prevents this; the check exists so no other caller can store body data
/// without it either.
final class HealthConsentMissing implements Exception {
  const new();
}

/// Writes everything onboarding collected, all or nothing.
final class OnboardingSaver {
  const new({
    required this.database,
    required this.riders,
    required this.garage,
    required this.readiness,
    required this.consents,
    required this.clock,
    required this.newId,
  });

  final AppDatabase database;
  final RiderRepository riders;
  final GarageRepository garage;
  final ReadinessRepository readiness;
  final ConsentRepository consents;
  final DateTime Function() clock;
  final String Function() newId;

  Future<void> save({
    required RiderProfile profile,
    required BikeType bikeType,
    required Map<ReadinessQuestion, bool> readinessAnswers,
    required Map<ConsentKind, bool> consentChoices,
  }) async {
    if (consentChoices[ConsentKind.healthData] != true) {
      throw const HealthConsentMissing();
    }
    // One transaction: if any write fails, none of them happened. Without it
    // a crash halfway could leave a profile with no consent on record - the
    // exact state the privacy rules forbid.
    await database.transaction(() async {
      // Consent first, so even inside the transaction body data is never
      // written ahead of the permission to hold it.
      for (final kind in ConsentKind.values) {
        await consents.record(kind, granted: consentChoices[kind] ?? false);
      }
      await riders.saveProfile(profile);
      await readiness.save(
        ReadinessScreening(
          answers: readinessAnswers,
          questionnaireVersion: readinessQuestionnaireVersion,
          completedAt: clock(),
        ),
      );
      await garage.saveBike(Bike(id: newId(), type: bikeType));
    });
  }
}

@Riverpod(keepAlive: true)
Future<OnboardingSaver> onboardingSaver(Ref ref) async => OnboardingSaver(
  database: await ref.watch(appDatabaseProvider.future),
  riders: await ref.watch(riderRepositoryProvider.future),
  garage: await ref.watch(garageRepositoryProvider.future),
  readiness: await ref.watch(readinessRepositoryProvider.future),
  consents: await ref.watch(consentRepositoryProvider.future),
  clock: ref.watch(clockProvider),
  newId: ref.watch(idGeneratorProvider),
);
