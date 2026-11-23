import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/core/science/bike_fit.dart';
import 'package:ride_doctor/core/science/confidence.dart';
import 'package:ride_doctor/core/science/explained.dart';

void main() {
  group('saddleHeightStartMm (LeMond)', () {
    test('0.883 x inseam', () {
      expect(saddleHeightStartMm(inseamMm: 800).value, closeTo(706.4, 1e-9));
      expect(saddleHeightStartMm(inseamMm: 760).value, closeTo(671.08, 1e-9));
    });

    test('is an estimate that points to a professional fit', () {
      final result = saddleHeightStartMm(inseamMm: 800);
      expect(result.confidence, Confidence.estimated);
      expect(result.formula, Formula.lemondSaddleHeight);
      expect(result.improvements, const [Improvement.getProfessionalFit]);
    });

    test('rejects a non-positive inseam', () {
      expect(() => saddleHeightStartMm(inseamMm: 0), throwsArgumentError);
    });
  });

  group('wheelCircumferenceMm', () {
    test('pi x (bead seat diameter + 2 x tyre width)', () {
      // 700x25C is 25-622: pi x 672 = 2111.15 mm.
      expect(
        wheelCircumferenceMm(beadSeatDiameterMm: 622, tyreWidthMm: 25).value,
        closeTo(2111.15, 0.01),
      );
      // 28-622: pi x 678 = 2130.00 mm.
      expect(
        wheelCircumferenceMm(beadSeatDiameterMm: 622, tyreWidthMm: 28).value,
        closeTo(2130.00, 0.01),
      );
    });

    test('the geometric value is Estimated and suggests a roll-out', () {
      final result = wheelCircumferenceMm(
        beadSeatDiameterMm: 622,
        tyreWidthMm: 25,
      );
      expect(result.confidence, Confidence.estimated);
      expect(result.formula, Formula.etrtoCircumference);
      expect(result.improvements, const [Improvement.rollOutWheel]);
    });

    test('a measured roll-out overrides the estimate and is Measured', () {
      final result = wheelCircumferenceMm(
        beadSeatDiameterMm: 622,
        tyreWidthMm: 25,
        measuredRollOutMm: 2098,
      );
      expect(result.value, 2098);
      expect(result.confidence, Confidence.measured);
      expect(result.formula, Formula.measuredCircumference);
    });

    test('rejects non-positive sizes', () {
      expect(
        () => wheelCircumferenceMm(beadSeatDiameterMm: 0, tyreWidthMm: 25),
        throwsArgumentError,
      );
      expect(
        () => wheelCircumferenceMm(beadSeatDiameterMm: 622, tyreWidthMm: 0),
        throwsArgumentError,
      );
    });
  });
}
