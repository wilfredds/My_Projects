import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/core/science/confidence.dart';
import 'package:ride_doctor/core/science/explained.dart';
import 'package:ride_doctor/core/science/heat_index.dart';
import 'package:ride_doctor/core/science/sources.dart';
import 'package:ride_doctor/l10n/l10n.dart';

/// Turns the science layer's enums into words and icons.
///
/// The science layer is pure Dart and knows no language; this is the single
/// place where each of its concepts gets its translated text. Every `switch`
/// here is exhaustive, so adding a formula without writing its explanation is
/// a compile error rather than a blank "Why?" sheet.
extension ScienceText on AppLocalizations {
  String confidenceLabel(Confidence confidence) => switch (confidence) {
    Confidence.measured => confidenceMeasured,
    Confidence.estimated => confidenceEstimated,
    Confidence.rough => confidenceRough,
  };

  String confidenceBody(Confidence confidence) => switch (confidence) {
    Confidence.measured => confidenceMeasuredBody,
    Confidence.estimated => confidenceEstimatedBody,
    Confidence.rough => confidenceRoughBody,
  };

  String formulaTitle(Formula formula) => switch (formula) {
    Formula.measuredMaxHr => formulaMeasuredMaxHrTitle,
    Formula.tanakaMaxHr => formulaTanakaMaxHrTitle,
    Formula.frielLthrZones => formulaFrielLthrZonesTitle,
    Formula.karvonenZones => formulaKarvonenZonesTitle,
    Formula.percentMaxHrZones => formulaPercentMaxHrZonesTitle,
    Formula.cogganPowerZones => formulaCogganPowerZonesTitle,
    Formula.wattsPerKg => formulaWattsPerKgTitle,
    Formula.lemondSaddleHeight => formulaLemondSaddleHeightTitle,
    Formula.etrtoCircumference => formulaEtrtoCircumferenceTitle,
    Formula.measuredCircumference => formulaMeasuredCircumferenceTitle,
    Formula.gearCadence => formulaGearCadenceTitle,
    Formula.climbPowerBalance => formulaClimbPowerBalanceTitle,
    Formula.nwsHeatIndex => formulaNwsHeatIndexTitle,
    Formula.sessionRpeLoad => formulaSessionRpeLoadTitle,
    Formula.loadTrend => formulaLoadTrendTitle,
    Formula.carbohydrateByDuration => formulaCarbohydrateByDurationTitle,
    Formula.sweatRate => formulaSweatRateTitle,
  };

  String formulaHow(Formula formula) => switch (formula) {
    Formula.measuredMaxHr => formulaMeasuredMaxHrHow,
    Formula.tanakaMaxHr => formulaTanakaMaxHrHow,
    Formula.frielLthrZones => formulaFrielLthrZonesHow,
    Formula.karvonenZones => formulaKarvonenZonesHow,
    Formula.percentMaxHrZones => formulaPercentMaxHrZonesHow,
    Formula.cogganPowerZones => formulaCogganPowerZonesHow,
    Formula.wattsPerKg => formulaWattsPerKgHow,
    Formula.lemondSaddleHeight => formulaLemondSaddleHeightHow,
    Formula.etrtoCircumference => formulaEtrtoCircumferenceHow,
    Formula.measuredCircumference => formulaMeasuredCircumferenceHow,
    Formula.gearCadence => formulaGearCadenceHow,
    Formula.climbPowerBalance => formulaClimbPowerBalanceHow,
    Formula.nwsHeatIndex => formulaNwsHeatIndexHow,
    Formula.sessionRpeLoad => formulaSessionRpeLoadHow,
    Formula.loadTrend => formulaLoadTrendHow,
    Formula.carbohydrateByDuration => formulaCarbohydrateByDurationHow,
    Formula.sweatRate => formulaSweatRateHow,
  };

  /// What the rider should keep in mind about this formula; null when there
  /// is nothing to add.
  String? formulaLimits(Formula formula) => switch (formula) {
    Formula.tanakaMaxHr => formulaTanakaMaxHrLimits,
    Formula.frielLthrZones => formulaFrielLthrZonesLimits,
    Formula.karvonenZones => formulaKarvonenZonesLimits,
    Formula.percentMaxHrZones => formulaPercentMaxHrZonesLimits,
    Formula.cogganPowerZones => formulaCogganPowerZonesLimits,
    Formula.lemondSaddleHeight => formulaLemondSaddleHeightLimits,
    Formula.etrtoCircumference => formulaEtrtoCircumferenceLimits,
    Formula.climbPowerBalance => formulaClimbPowerBalanceLimits,
    Formula.nwsHeatIndex => formulaNwsHeatIndexLimits,
    Formula.sessionRpeLoad => formulaSessionRpeLoadLimits,
    Formula.loadTrend => formulaLoadTrendLimits,
    Formula.carbohydrateByDuration => formulaCarbohydrateByDurationLimits,
    Formula.sweatRate => formulaSweatRateLimits,
    Formula.measuredMaxHr ||
    Formula.wattsPerKg ||
    Formula.measuredCircumference ||
    Formula.gearCadence => null,
  };

  String improvementText(Improvement improvement) => switch (improvement) {
    Improvement.measureMaxHr => improveMeasureMaxHr,
    Improvement.measureRestingHr => improveMeasureRestingHr,
    Improvement.doLthrTest => improveDoLthrTest,
    Improvement.doFtpTest => improveDoFtpTest,
    Improvement.rollOutWheel => improveRollOutWheel,
    Improvement.confirmCogs => improveConfirmCogs,
    Improvement.getProfessionalFit => improveGetProfessionalFit,
    Improvement.usePowerMeter => improveUsePowerMeter,
    Improvement.logEveryRide => improveLogEveryRide,
    Improvement.measureSweatRate => improveMeasureSweatRate,
    Improvement.practiseFuelling => improvePractiseFuelling,
  };

  String inputLabel(Quantity quantity) => switch (quantity) {
    Quantity.ageYears => inputAgeYears,
    Quantity.restingHeartRateBpm => inputRestingHeartRateBpm,
    Quantity.maxHeartRateBpm => inputMaxHeartRateBpm,
    Quantity.lthrBpm => inputLthrBpm,
    Quantity.ftpWatts => inputFtpWatts,
    Quantity.powerWatts => inputPowerWatts,
    Quantity.massKg => inputMassKg,
    Quantity.totalMassKg => inputTotalMassKg,
    Quantity.inseamMm => inputInseamMm,
    Quantity.beadSeatDiameterMm => inputBeadSeatDiameterMm,
    Quantity.tyreWidthMm => inputTyreWidthMm,
    Quantity.circumferenceMm => inputCircumferenceMm,
    Quantity.gradePercent => inputGradePercent,
    Quantity.temperatureC => inputTemperatureC,
    Quantity.humidityPercent => inputHumidityPercent,
    Quantity.effortRating => inputEffortRating,
    Quantity.durationMinutes => inputDurationMinutes,
    Quantity.sessionLoad => inputSessionLoad,
    Quantity.usualWeekLoad => inputUsualWeekLoad,
    Quantity.bodyMassBeforeKg => inputBodyMassBeforeKg,
    Quantity.bodyMassAfterKg => inputBodyMassAfterKg,
    Quantity.fluidDrunkLitres => inputFluidDrunkLitres,
    Quantity.urineLitres => inputUrineLitres,
  };

  /// The unit each quantity is held in inside the science layer.
  String inputUnit(Quantity quantity) => switch (quantity) {
    Quantity.ageYears => unitYears,
    Quantity.restingHeartRateBpm ||
    Quantity.maxHeartRateBpm ||
    Quantity.lthrBpm => 'bpm',
    Quantity.ftpWatts || Quantity.powerWatts => 'W',
    Quantity.massKg || Quantity.totalMassKg => 'kg',
    Quantity.inseamMm ||
    Quantity.beadSeatDiameterMm ||
    Quantity.tyreWidthMm ||
    Quantity.circumferenceMm => 'mm',
    Quantity.gradePercent || Quantity.humidityPercent => '%',
    Quantity.temperatureC => '°C',
    Quantity.effortRating => unitOutOfTen,
    Quantity.durationMinutes => unitMinutes,
    Quantity.sessionLoad || Quantity.usualWeekLoad => unitLoadPoints,
    Quantity.bodyMassBeforeKg || Quantity.bodyMassAfterKg => 'kg',
    Quantity.fluidDrunkLitres || Quantity.urineLitres => 'L',
  };

  String sourceStatusLabel(SourceStatus status) => switch (status) {
    SourceStatus.verified => sourceVerified,
    SourceStatus.partly => sourcePartly,
    SourceStatus.unverified => sourceUnverified,
  };

  String heatRiskLabel(HeatRisk risk) => switch (risk) {
    HeatRisk.notHazardous => heatNotHazardous,
    HeatRisk.caution => heatCaution,
    HeatRisk.extremeCaution => heatExtremeCaution,
    HeatRisk.danger => heatDanger,
    HeatRisk.extremeDanger => heatExtremeDanger,
  };

  String heatAdvice(HeatRisk risk) => switch (risk) {
    HeatRisk.notHazardous => heatAdviceNotHazardous,
    HeatRisk.caution => heatAdviceCaution,
    HeatRisk.extremeCaution => heatAdviceExtremeCaution,
    HeatRisk.danger => heatAdviceDanger,
    HeatRisk.extremeDanger => heatAdviceExtremeDanger,
  };
}

/// One icon per confidence level, so the level is never signalled by colour
/// alone.
IconData confidenceIcon(Confidence confidence) => switch (confidence) {
  Confidence.measured => Icons.sensors,
  Confidence.estimated => Icons.functions,
  Confidence.rough => Icons.blur_on,
};

IconData heatRiskIcon(HeatRisk risk) => switch (risk) {
  HeatRisk.notHazardous => Icons.check_circle_outline,
  HeatRisk.caution => Icons.wb_sunny_outlined,
  HeatRisk.extremeCaution => Icons.thermostat,
  HeatRisk.danger => Icons.warning_amber_rounded,
  HeatRisk.extremeDanger => Icons.dangerous_outlined,
};
