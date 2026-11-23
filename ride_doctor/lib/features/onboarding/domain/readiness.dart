import 'package:freezed_annotation/freezed_annotation.dart';

part 'readiness.freezed.dart';

/// The topics of the pre-participation readiness check.
///
/// These are OUR OWN plain-language questions on the topics such screenings
/// usually cover. They are deliberately NOT the PAR-Q+: that questionnaire is
/// copyrighted and its terms restrict embedding it in apps (docs/SCIENCE.md,
/// "Readiness check"). The wording lives in the ARB files and must be reviewed
/// by a medical professional before any public release.
enum ReadinessQuestion {
  heartCondition,
  chestPain,
  dizzinessOrFainting,
  chronicCondition,
  prescribedMedication,
  boneOrJointProblem,
  toldToExerciseSupervised,
}

/// Bump when the wording or the set of questions changes, so stored answers
/// always say which version they answered.
const readinessQuestionnaireVersion = 1;

@freezed
abstract class ReadinessScreening with _$ReadinessScreening {
  const factory({
    required Map<ReadinessQuestion, bool> answers,
    required int questionnaireVersion,
    required DateTime completedAt,
  }) = _ReadinessScreening;

  const new _();

  /// Any "yes" means: recommend seeing a doctor before hard training or
  /// racing. It never blocks the app and is never a diagnosis.
  bool get anyYes => answers.values.any((yes) => yes);

  /// True once every question has an answer.
  bool get isComplete => ReadinessQuestion.values.every(answers.containsKey);
}
