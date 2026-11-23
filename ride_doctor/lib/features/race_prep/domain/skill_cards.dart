import 'package:ride_doctor/features/race_prep/domain/race_event.dart';

/// The skills and tactics library: one short card per idea, each with a drill
/// that can be practised alone and safely. The wording lives in the ARB
/// files; this only says which cards belong to which kind of race.
enum SkillCard {
  // Criterium
  holdYourLine,
  cornering,
  noOverlappingWheels,
  ridingInAPack,
  stayInFrontThird,
  shiftBeforeCorners,
  droppedOrLapped,
  primes,
  // Road race
  drafting,
  climbPacing,
  eatAndDrinkEarly,
  // Time trial
  evenPacing,
  holdThePosition,
  // Gravel
  looseSurfaceControl,
  selfSufficiency,
  // MTB cross-country
  startEffort,
  lookAhead,
}

/// The cards shown for a race of this type, most important first.
List<SkillCard> skillCardsFor(RaceType type) => switch (type) {
  RaceType.criterium => const [
    SkillCard.holdYourLine,
    SkillCard.cornering,
    SkillCard.shiftBeforeCorners,
    SkillCard.noOverlappingWheels,
    SkillCard.ridingInAPack,
    SkillCard.stayInFrontThird,
    SkillCard.primes,
    SkillCard.droppedOrLapped,
  ],
  RaceType.roadRace => const [
    SkillCard.drafting,
    SkillCard.holdYourLine,
    SkillCard.noOverlappingWheels,
    SkillCard.climbPacing,
    SkillCard.eatAndDrinkEarly,
    SkillCard.cornering,
  ],
  RaceType.timeTrial => const [
    SkillCard.evenPacing,
    SkillCard.holdThePosition,
    SkillCard.cornering,
  ],
  RaceType.gravel => const [
    SkillCard.looseSurfaceControl,
    SkillCard.selfSufficiency,
    SkillCard.eatAndDrinkEarly,
    SkillCard.climbPacing,
  ],
  RaceType.mtbXc => const [
    SkillCard.startEffort,
    SkillCard.lookAhead,
    SkillCard.looseSurfaceControl,
    SkillCard.climbPacing,
  ],
};
