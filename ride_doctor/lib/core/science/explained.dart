import 'package:meta/meta.dart';
import 'package:ride_doctor/core/science/confidence.dart';

/// Which calculation produced a value. The UI turns this into the plain-words
/// explanation on the "Why?" sheet, and docs/SCIENCE.md documents each one
/// under the same name.
enum Formula {
  measuredMaxHr,
  tanakaMaxHr,
  frielLthrZones,
  karvonenZones,
  percentMaxHrZones,
  cogganPowerZones,
  wattsPerKg,
  lemondSaddleHeight,
  etrtoCircumference,
  measuredCircumference,
  gearCadence,
  climbPowerBalance,
  nwsHeatIndex,
}

/// The quantities that can feed a calculation, with the unit they are always
/// expressed in inside the science layer (SI-style metric; the UI converts for
/// display).
enum Quantity {
  ageYears,
  restingHeartRateBpm,
  maxHeartRateBpm,
  lthrBpm,
  ftpWatts,
  powerWatts,
  massKg,
  totalMassKg,
  inseamMm,
  beadSeatDiameterMm,
  tyreWidthMm,
  circumferenceMm,
  gradePercent,
  temperatureC,
  humidityPercent,
}

/// Something the rider could do to move a result up the confidence ladder.
enum Improvement {
  measureMaxHr,
  measureRestingHr,
  doLthrTest,
  doFtpTest,
  rollOutWheel,
  confirmCogs,
  getProfessionalFit,
  usePowerMeter,
}

/// One input that went into a calculation.
@immutable
final class Input {
  const new(this.quantity, this.value);

  final Quantity quantity;
  final num value;

  @override
  bool operator ==(Object other) =>
      other is Input && other.quantity == quantity && other.value == value;

  @override
  int get hashCode => Object.hash(quantity, value);

  @override
  String toString() => '${quantity.name}=$value';
}

/// A calculated value that carries its own explanation.
///
/// Nothing in the science layer returns a bare number to the UI: every result
/// says how trustworthy it is, which formula made it, what went in, and what
/// would make it better. That is what lets every screen answer "Why?".
@immutable
final class Explained<T> {
  const new({
    required this.value,
    required this.confidence,
    required this.formula,
    this.inputs = const [],
    this.improvements = const [],
  });

  final T value;
  final Confidence confidence;
  final Formula formula;
  final List<Input> inputs;
  final List<Improvement> improvements;
}
