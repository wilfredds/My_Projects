import 'package:ride_doctor/features/profile/domain/bike.dart';
import 'package:ride_doctor/features/profile/domain/rider_profile.dart';
import 'package:ride_doctor/l10n/l10n.dart';

/// Translated names for the profile's enums. Exhaustive switches: adding an
/// enum value without a label will not compile.
extension ProfileText on AppLocalizations {
  String bikeTypeLabel(BikeType type) => switch (type) {
    BikeType.road => bikeRoad,
    BikeType.gravel => bikeGravel,
    BikeType.mtb => bikeMtb,
    BikeType.hybrid => bikeHybrid,
    BikeType.converted => bikeConverted,
  };

  String goalLabel(RidingGoal goal) => switch (goal) {
    RidingGoal.finishFirstRace => goalFinishFirstRace,
    RidingGoal.raceFaster => goalRaceFaster,
    RidingGoal.ridePainFree => goalRidePainFree,
    RidingGoal.buildEndurance => goalBuildEndurance,
    RidingGoal.generalFitness => goalGeneralFitness,
  };

  String sexLabel(Sex sex) => switch (sex) {
    Sex.female => sexFemale,
    Sex.male => sexMale,
    Sex.preferNotToSay => sexPreferNotToSay,
  };

  String pedalLabel(PedalType pedals) => switch (pedals) {
    PedalType.flat => pedalsFlat,
    PedalType.clipless => pedalsClipless,
  };

  String sensorLabel(SensorKind kind) => switch (kind) {
    SensorKind.hrStrap => sensorHrStrap,
    SensorKind.cadence => sensorCadence,
    SensorKind.speed => sensorSpeed,
    SensorKind.powerMeter => sensorPowerMeter,
    SensorKind.bikeComputer => sensorBikeComputer,
    SensorKind.smartwatch => sensorSmartwatch,
  };
}
