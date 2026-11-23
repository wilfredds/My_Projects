import 'dart:math' as math;

import 'package:meta/meta.dart';
import 'package:ride_doctor/core/science/confidence.dart';
import 'package:ride_doctor/core/science/constants.dart';
import 'package:ride_doctor/core/science/explained.dart';
import 'package:ride_doctor/core/science/gearing.dart';

/// Density of dry air from the ideal gas law: rho = p / (R x T), in kg/m^3.
double airDensity({
  required double temperatureC,
  double pressurePa = standardPressurePa,
}) => pressurePa / (dryAirGasConstant * (temperatureC + zeroCelsiusInKelvin));

/// Everything about the rider, bike and road that the power equation needs.
@immutable
final class ClimbConditions {
  const new({
    required this.totalMassKg,
    required this.gradePercent,
    this.crr = defaultCrr,
    this.cdA = defaultCdA,
    this.airDensity = standardAirDensity,
    this.drivetrainEfficiency = defaultDrivetrainEfficiency,
  }) : assert(totalMassKg > 0, 'mass must be positive'),
       assert(gradePercent >= 0, 'this model is for flat roads and climbs');

  /// Rider + bike + kit.
  final double totalMassKg;

  /// Rise over run x 100: a 5% grade climbs 5 m per 100 m travelled.
  final double gradePercent;

  final double crr;
  final double cdA;
  final double airDensity;
  final double drivetrainEfficiency;
}

/// Pedalling power needed to hold [speedMs] (SCIENCE.md 7.8):
///
///   P x efficiency = v x [ m g (sin a + Crr cos a) + 1/2 rho CdA v^2 ]
///
/// Three forces resist the rider: gravity along the slope, tyre rolling
/// resistance, and air drag. Power is force times speed.
double powerRequiredW({
  required double speedMs,
  required ClimbConditions conditions,
}) {
  final slope = math.atan(conditions.gradePercent / 100);
  final gravityAndRolling =
      conditions.totalMassKg *
      standardGravity *
      (math.sin(slope) + conditions.crr * math.cos(slope));
  final drag = 0.5 * conditions.airDensity * conditions.cdA * speedMs * speedMs;
  return speedMs * (gravityAndRolling + drag) / conditions.drivetrainEfficiency;
}

/// The speed a rider reaches at [powerW], in m/s.
///
/// The power equation is a cubic in speed with no tidy inverse, so we solve
/// it numerically by bisection: required power only ever rises with speed (on
/// a flat or uphill road), so we can keep halving an interval that brackets
/// the answer. It cannot diverge, which matters more here than speed.
double speedForPowerMs({
  required double powerW,
  required ClimbConditions conditions,
}) {
  if (powerW <= 0) {
    throw ArgumentError.value(powerW, 'powerW', 'must be positive');
  }
  var low = 0.0;
  var high = 1.0;
  while (powerRequiredW(speedMs: high, conditions: conditions) < powerW) {
    high *= 2;
  }
  // Each pass halves the interval; 60 passes is far below a micrometre per
  // second.
  for (var i = 0; i < 60; i++) {
    final mid = (low + high) / 2;
    if (powerRequiredW(speedMs: mid, conditions: conditions) < powerW) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}

/// How hard the rider intends to go up the climb.
enum Effort { easy, steady, hard }

/// The power a rider is likely to hold on a climb at [effort].
///
/// With an FTP it is a fraction of it (Estimated: a real threshold, an assumed
/// fraction). Without one it falls back to a default W/kg for a recreational
/// rider, which is a guess about a person we have not measured - Rough.
Explained<double> climbingPowerW({
  required Effort effort,
  required double riderMassKg,
  int? ftpWatts,
}) {
  if (ftpWatts != null) {
    return Explained(
      value: ftpWatts * climbEffortFtpFractions[effort.index],
      confidence: Confidence.estimated,
      formula: Formula.climbPowerBalance,
      inputs: [Input(Quantity.ftpWatts, ftpWatts)],
      improvements: const [Improvement.usePowerMeter],
    );
  }
  return Explained(
    value: riderMassKg * climbEffortDefaultWattsPerKg[effort.index],
    confidence: Confidence.rough,
    formula: Formula.climbPowerBalance,
    inputs: [Input(Quantity.massKg, riderMassKg)],
    improvements: const [Improvement.doFtpTest, Improvement.usePowerMeter],
  );
}

/// A gear together with the cadence it needs at the predicted speed.
@immutable
final class GearCadence {
  const new(this.gear, this.cadenceRpm);

  final Gear gear;
  final double cadenceRpm;
}

/// What a climb will feel like in each gear, and what to do about it.
@immutable
final class ClimbGearing {
  const new({
    required this.speedKmh,
    required this.powerW,
    required this.options,
    required this.recommended,
    required this.willGrind,
    this.cogForComfort,
    this.chainringForComfort,
  });

  final double speedKmh;
  final double powerW;

  /// Every gear, easiest first.
  final List<GearCadence> options;

  /// The gear whose cadence is nearest the middle of the target band.
  final GearCadence recommended;

  /// True when even the easiest gear turns slower than [grindCadenceRpm].
  final bool willGrind;

  /// Only when [willGrind]: the smallest rear cog that would reach
  /// [comfortableClimbCadenceRpm] with the current small chainring.
  final int? cogForComfort;

  /// Only when [willGrind]: the largest small chainring that would reach it
  /// with the current largest cog.
  final int? chainringForComfort;
}

/// Cadence in every gear at [speedKmh], the best gear to use, and - if the
/// rider would be grinding - the easier gearing that would fix it.
ClimbGearing gearingForSpeed({
  required double speedKmh,
  required double powerW,
  required List<int> chainrings,
  required List<int> cogs,
  required double circumferenceMm,
}) {
  final options = [
    for (final gear in allGears(chainrings: chainrings, cogs: cogs))
      GearCadence(
        gear,
        gear.cadenceRpm(speedKmh: speedKmh, circumferenceMm: circumferenceMm),
      ),
  ];
  const targetRpm = (targetCadenceLowRpm + targetCadenceHighRpm) / 2;
  final recommended = options.reduce(
    (a, b) =>
        (a.cadenceRpm - targetRpm).abs() <= (b.cadenceRpm - targetRpm).abs()
        ? a
        : b,
  );
  final easiest = options.first;
  final willGrind = easiest.cadenceRpm < grindCadenceRpm;

  // cadence = wheelTurnsPerMinute x cog / chainring, so for a wanted cadence:
  //   cog       = cadence x chainring / wheelTurnsPerMinute   (round up)
  //   chainring = wheelTurnsPerMinute x cog / cadence         (round down)
  // Rounding toward the easier side guarantees the target is actually met.
  final wheelTurnsPerMinute = speedKmh * 1000 / 60 / (circumferenceMm / 1000);
  return ClimbGearing(
    speedKmh: speedKmh,
    powerW: powerW,
    options: options,
    recommended: recommended,
    willGrind: willGrind,
    cogForComfort: willGrind
        ? (comfortableClimbCadenceRpm *
                  easiest.gear.chainring /
                  wheelTurnsPerMinute)
              .ceil()
        : null,
    chainringForComfort: willGrind
        ? math.max(
            1,
            (wheelTurnsPerMinute *
                    easiest.gear.cog /
                    comfortableClimbCadenceRpm)
                .floor(),
          )
        : null,
  );
}

/// Predicts speed up a climb and what gear to ride it in.
///
/// The result is no more trustworthy than its weakest ingredient: the power
/// estimate, the wheel size, and whether the cog list is confirmed or guessed.
/// It is capped at Estimated because Crr and CdA are typical values, not this
/// rider's.
Explained<ClimbGearing> predictClimb({
  required Explained<double> power,
  required double riderMassKg,
  required double gradePercent,
  required List<int> chainrings,
  required List<int> cogs,
  required bool cogsConfirmed,
  required Explained<double> circumference,
  double bikeAndKitKg = defaultBikeAndKitKg,
  double airDensity = standardAirDensity,
}) {
  final totalMassKg = riderMassKg + bikeAndKitKg;
  final speedMs = speedForPowerMs(
    powerW: power.value,
    conditions: ClimbConditions(
      totalMassKg: totalMassKg,
      gradePercent: gradePercent,
      airDensity: airDensity,
    ),
  );
  return Explained(
    value: gearingForSpeed(
      speedKmh: speedMs * 3.6,
      powerW: power.value,
      chainrings: chainrings,
      cogs: cogs,
      circumferenceMm: circumference.value,
    ),
    confidence: Confidence.weakest([
      Confidence.estimated,
      power.confidence,
      circumference.confidence,
      if (!cogsConfirmed) Confidence.rough,
    ]),
    formula: Formula.climbPowerBalance,
    inputs: [
      Input(Quantity.powerWatts, power.value),
      Input(Quantity.totalMassKg, totalMassKg),
      Input(Quantity.gradePercent, gradePercent),
      Input(Quantity.circumferenceMm, circumference.value),
    ],
    improvements: [
      ...power.improvements,
      ...circumference.improvements,
      if (!cogsConfirmed) Improvement.confirmCogs,
    ],
  );
}
