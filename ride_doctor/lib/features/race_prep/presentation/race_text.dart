import 'package:ride_doctor/features/race_prep/domain/countdown.dart';
import 'package:ride_doctor/features/race_prep/domain/race_checklist.dart';
import 'package:ride_doctor/features/race_prep/domain/race_day_timeline.dart';
import 'package:ride_doctor/features/race_prep/domain/race_debrief.dart';
import 'package:ride_doctor/features/race_prep/domain/race_event.dart';
import 'package:ride_doctor/features/race_prep/domain/skill_cards.dart';
import 'package:ride_doctor/l10n/l10n.dart';

/// Translated text for every race-prep enum. All switches are exhaustive, so
/// a new checklist item or skill card without wording does not compile.
extension RaceText on AppLocalizations {
  String raceTypeLabel(RaceType type) => switch (type) {
    RaceType.criterium => raceTypeCriterium,
    RaceType.roadRace => raceTypeRoadRace,
    RaceType.timeTrial => raceTypeTimeTrial,
    RaceType.gravel => raceTypeGravel,
    RaceType.mtbXc => raceTypeMtbXc,
  };

  String modeTitle(CountdownMode mode) => switch (mode) {
    CountdownMode.longBuild => modeLongBuildTitle,
    CountdownMode.compressedBuild => modeCompressedBuildTitle,
    CountdownMode.raceWeek => modeRaceWeekTitle,
    CountdownMode.raceDay => modeRaceDayTitle,
    CountdownMode.raceOver => modeRaceOverTitle,
  };

  String modeBody(CountdownMode mode) => switch (mode) {
    CountdownMode.longBuild => modeLongBuildBody,
    CountdownMode.compressedBuild => modeCompressedBuildBody,
    CountdownMode.raceWeek => modeRaceWeekBody,
    CountdownMode.raceDay => modeRaceDayBody,
    CountdownMode.raceOver => modeRaceOverBody,
  };

  String phaseName(PlanPhase phase) => switch (phase) {
    PlanPhase.base => phaseBase,
    PlanPhase.build => phaseBuild,
    PlanPhase.taper => phaseTaper,
  };

  String phaseBody(PlanPhase phase) => switch (phase) {
    PlanPhase.base => phaseBaseBody,
    PlanPhase.build => phaseBuildBody,
    PlanPhase.taper => phaseTaperBody,
  };

  /// "In 5 days", "Tomorrow", "Today", "Yesterday", "12 days ago".
  ///
  /// Chosen here in code, NOT with an ICU plural in the ARB file. Plural
  /// categories are grammatical, not numeric: in Filipino the "one" category
  /// covers 1, 2, 3, 5, 7, 8... so a plural message written as
  /// `=1{Tomorrow} other{In N days}` showed "Bukas" (tomorrow) for a race
  /// five days away. "Exactly one" must be an `if`, never a plural branch.
  String raceWhen(int daysUntil) => switch (daysUntil) {
    0 => raceToday,
    1 => raceTomorrow,
    -1 => raceYesterday,
    > 1 => raceInDays(daysUntil),
    _ => raceDaysAgo(-daysUntil),
  };

  String timelineStepLabel(TimelineStep step) => switch (step) {
    TimelineStep.wakeUp => timelineWakeUp,
    TimelineStep.preRaceMeal => timelinePreRaceMeal,
    TimelineStep.leaveHome => timelineLeaveHome,
    TimelineStep.arrive => timelineArrive,
    TimelineStep.registration => timelineRegistration,
    TimelineStep.reconLaps => timelineReconLaps,
    TimelineStep.warmUpStart => timelineWarmUpStart,
    TimelineStep.warmUpEnd => timelineWarmUpEnd,
    TimelineStep.finalBottleAndToilet => timelineFinalBottleAndToilet,
    TimelineStep.lineUp => timelineLineUp,
    TimelineStep.raceStart => timelineRaceStart,
  };

  String checklistGroupLabel(ChecklistGroup group) => switch (group) {
    ChecklistGroup.bike => checklistGroupBike,
    ChecklistGroup.kit => checklistGroupKit,
    ChecklistGroup.documents => checklistGroupDocuments,
    ChecklistGroup.nutrition => checklistGroupNutrition,
    ChecklistGroup.tools => checklistGroupTools,
  };

  String checklistItemLabel(ChecklistItem item) => switch (item) {
    ChecklistItem.tyrePressure => checkTyrePressure,
    ChecklistItem.wheelsSecure => checkWheelsSecure,
    ChecklistItem.boltsTight => checkBoltsTight,
    ChecklistItem.brakesWork => checkBrakesWork,
    ChecklistItem.gearsShift => checkGearsShift,
    ChecklistItem.barEndPlugs => checkBarEndPlugs,
    ChecklistItem.helmet => checkHelmet,
    ChecklistItem.shoes => checkShoes,
    ChecklistItem.jerseyAndShorts => checkJerseyAndShorts,
    ChecklistItem.glovesAndGlasses => checkGlovesAndGlasses,
    ChecklistItem.sunscreen => checkSunscreen,
    ChecklistItem.identification => checkIdentification,
    ChecklistItem.licenceOrWaiver => checkLicenceOrWaiver,
    ChecklistItem.raceNumberAndPins => checkRaceNumberAndPins,
    ChecklistItem.bottlesFilled => checkBottlesFilled,
    ChecklistItem.raceFood => checkRaceFood,
    ChecklistItem.preRaceMealPlanned => checkPreRaceMealPlanned,
    ChecklistItem.spareTube => checkSpareTube,
    ChecklistItem.pumpOrInflator => checkPumpOrInflator,
    ChecklistItem.multiTool => checkMultiTool,
  };

  /// (title, what to do, a drill to practise it).
  (String, String, String) skillCardText(SkillCard card) => switch (card) {
    SkillCard.holdYourLine => (
      skillHoldYourLineTitle,
      skillHoldYourLineBody,
      skillHoldYourLineDrill,
    ),
    SkillCard.cornering => (
      skillCorneringTitle,
      skillCorneringBody,
      skillCorneringDrill,
    ),
    SkillCard.noOverlappingWheels => (
      skillNoOverlappingWheelsTitle,
      skillNoOverlappingWheelsBody,
      skillNoOverlappingWheelsDrill,
    ),
    SkillCard.ridingInAPack => (
      skillRidingInAPackTitle,
      skillRidingInAPackBody,
      skillRidingInAPackDrill,
    ),
    SkillCard.stayInFrontThird => (
      skillStayInFrontThirdTitle,
      skillStayInFrontThirdBody,
      skillStayInFrontThirdDrill,
    ),
    SkillCard.shiftBeforeCorners => (
      skillShiftBeforeCornersTitle,
      skillShiftBeforeCornersBody,
      skillShiftBeforeCornersDrill,
    ),
    SkillCard.droppedOrLapped => (
      skillDroppedOrLappedTitle,
      skillDroppedOrLappedBody,
      skillDroppedOrLappedDrill,
    ),
    SkillCard.primes => (skillPrimesTitle, skillPrimesBody, skillPrimesDrill),
    SkillCard.drafting => (
      skillDraftingTitle,
      skillDraftingBody,
      skillDraftingDrill,
    ),
    SkillCard.climbPacing => (
      skillClimbPacingTitle,
      skillClimbPacingBody,
      skillClimbPacingDrill,
    ),
    SkillCard.eatAndDrinkEarly => (
      skillEatAndDrinkEarlyTitle,
      skillEatAndDrinkEarlyBody,
      skillEatAndDrinkEarlyDrill,
    ),
    SkillCard.evenPacing => (
      skillEvenPacingTitle,
      skillEvenPacingBody,
      skillEvenPacingDrill,
    ),
    SkillCard.holdThePosition => (
      skillHoldThePositionTitle,
      skillHoldThePositionBody,
      skillHoldThePositionDrill,
    ),
    SkillCard.looseSurfaceControl => (
      skillLooseSurfaceControlTitle,
      skillLooseSurfaceControlBody,
      skillLooseSurfaceControlDrill,
    ),
    SkillCard.selfSufficiency => (
      skillSelfSufficiencyTitle,
      skillSelfSufficiencyBody,
      skillSelfSufficiencyDrill,
    ),
    SkillCard.startEffort => (
      skillStartEffortTitle,
      skillStartEffortBody,
      skillStartEffortDrill,
    ),
    SkillCard.lookAhead => (
      skillLookAheadTitle,
      skillLookAheadBody,
      skillLookAheadDrill,
    ),
  };

  String droppedLabel(DroppedWhen when) => switch (when) {
    DroppedWhen.notDropped => droppedNotDropped,
    DroppedWhen.earlyOn => droppedEarlyOn,
    DroppedWhen.midRace => droppedMidRace,
    DroppedWhen.nearTheEnd => droppedNearTheEnd,
  };

  String struggleLabel(StruggleArea area) => switch (area) {
    StruggleArea.climbs => struggleClimbs,
    StruggleArea.corners => struggleCorners,
    StruggleArea.positioning => strugglePositioning,
    StruggleArea.accelerations => struggleAccelerations,
    StruggleArea.sprint => struggleSprint,
    StruggleArea.pacing => strugglePacing,
    StruggleArea.fuelling => struggleFuelling,
    StruggleArea.heat => struggleHeat,
    StruggleArea.mechanical => struggleMechanical,
    StruggleArea.nerves => struggleNerves,
  };

  String symptomLabel(RaceSymptom symptom) => switch (symptom) {
    RaceSymptom.cramps => symptomCramps,
    RaceSymptom.breathless => symptomBreathless,
    RaceSymptom.pain => symptomPain,
    RaceSymptom.numbness => symptomNumbness,
    RaceSymptom.dizziness => symptomDizziness,
  };
}

/// "06:30". A 24-hour clock avoids any am/pm mix-up on race morning.
String clockTime(DateTime time) =>
    '${time.hour.toString().padLeft(2, '0')}:'
    '${time.minute.toString().padLeft(2, '0')}';
