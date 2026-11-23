import 'package:ride_doctor/features/onboarding/domain/consent.dart';
import 'package:ride_doctor/features/onboarding/domain/readiness.dart';
import 'package:ride_doctor/l10n/l10n.dart';

extension OnboardingText on AppLocalizations {
  String readinessQuestionText(ReadinessQuestion question) =>
      switch (question) {
        ReadinessQuestion.heartCondition => readinessHeartCondition,
        ReadinessQuestion.chestPain => readinessChestPain,
        ReadinessQuestion.dizzinessOrFainting => readinessDizzinessOrFainting,
        ReadinessQuestion.chronicCondition => readinessChronicCondition,
        ReadinessQuestion.prescribedMedication => readinessPrescribedMedication,
        ReadinessQuestion.boneOrJointProblem => readinessBoneOrJointProblem,
        ReadinessQuestion.toldToExerciseSupervised =>
          readinessToldToExerciseSupervised,
      };

  String consentTitle(ConsentKind kind) => switch (kind) {
    ConsentKind.healthData => consentHealthTitle,
    ConsentKind.location => consentLocationTitle,
    ConsentKind.notifications => consentNotificationsTitle,
  };

  String consentBody(ConsentKind kind) => switch (kind) {
    ConsentKind.healthData => consentHealthBody,
    ConsentKind.location => consentLocationBody,
    ConsentKind.notifications => consentNotificationsBody,
  };
}
