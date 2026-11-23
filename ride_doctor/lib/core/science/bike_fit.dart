import 'dart:math' as math;

import 'package:ride_doctor/core/science/confidence.dart';
import 'package:ride_doctor/core/science/constants.dart';
import 'package:ride_doctor/core/science/explained.dart';

/// A starting saddle height in mm, measured from the centre of the bottom
/// bracket to the top of the saddle along the seat tube: 0.883 x inseam
/// (SCIENCE.md 7.5).
///
/// It is a starting point, not a target. Always present it with "adjust 2-3 mm
/// at a time".
Explained<double> saddleHeightStartMm({required double inseamMm}) {
  if (inseamMm <= 0) {
    throw ArgumentError.value(inseamMm, 'inseamMm', 'must be positive');
  }
  return Explained(
    value: lemondInseamFactor * inseamMm,
    confidence: Confidence.estimated,
    formula: Formula.lemondSaddleHeight,
    inputs: [Input(Quantity.inseamMm, inseamMm)],
    improvements: const [Improvement.getProfessionalFit],
  );
}

/// Wheel circumference in mm (SCIENCE.md 7.6).
///
/// A roll-out measurement, when the rider has one, beats the geometric
/// estimate: a real tyre sits wider or narrower than its label and squashes
/// under load.
Explained<double> wheelCircumferenceMm({
  required int beadSeatDiameterMm,
  required int tyreWidthMm,
  double? measuredRollOutMm,
}) {
  if (measuredRollOutMm != null) {
    return Explained(
      value: measuredRollOutMm,
      confidence: Confidence.measured,
      formula: Formula.measuredCircumference,
      inputs: [Input(Quantity.circumferenceMm, measuredRollOutMm)],
    );
  }
  if (beadSeatDiameterMm <= 0 || tyreWidthMm <= 0) {
    throw ArgumentError('wheel and tyre sizes must be positive');
  }
  return Explained(
    value: math.pi * (beadSeatDiameterMm + 2 * tyreWidthMm),
    confidence: Confidence.estimated,
    formula: Formula.etrtoCircumference,
    inputs: [
      Input(Quantity.beadSeatDiameterMm, beadSeatDiameterMm),
      Input(Quantity.tyreWidthMm, tyreWidthMm),
    ],
    improvements: const [Improvement.rollOutWheel],
  );
}
