import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/core/units/units.dart';

void main() {
  test('mass', () {
    expect(Units.poundsToKg(150), closeTo(68.0389, 0.0001));
    expect(Units.kgToPounds(70), closeTo(154.3236, 0.0001));
  });

  test('length', () {
    expect(Units.inchesToMm(30), closeTo(762, 1e-9));
    expect(Units.mmToInches(762), closeTo(30, 1e-9));
  });

  test('distance', () {
    expect(Units.milesToKm(10), closeTo(16.09344, 1e-9));
    expect(Units.kmToMiles(40), closeTo(24.8548, 0.0001));
  });

  test('temperature', () {
    expect(Units.celsiusToFahrenheit(30), closeTo(86, 1e-9));
    expect(Units.fahrenheitToCelsius(212), closeTo(100, 1e-9));
    expect(Units.fahrenheitToCelsius(-40), closeTo(-40, 1e-9));
  });

  test('pressure', () {
    expect(Units.psiToBar(100), closeTo(6.8948, 0.0001));
    expect(Units.barToPsi(6), closeTo(87.0226, 0.0001));
  });

  test('every conversion round-trips', () {
    for (final value in [0.5, 1.0, 37.2, 250.0]) {
      expect(Units.kgToPounds(Units.poundsToKg(value)), closeTo(value, 1e-9));
      expect(Units.mmToInches(Units.inchesToMm(value)), closeTo(value, 1e-9));
      expect(Units.kmToMiles(Units.milesToKm(value)), closeTo(value, 1e-9));
      expect(
        Units.celsiusToFahrenheit(Units.fahrenheitToCelsius(value)),
        closeTo(value, 1e-9),
      );
      expect(Units.barToPsi(Units.psiToBar(value)), closeTo(value, 1e-9));
    }
  });
}
