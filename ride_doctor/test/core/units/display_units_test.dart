import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/core/units/display_units.dart';

void main() {
  const metric = DisplayUnits(metric: true);
  const imperial = DisplayUnits(metric: false);

  test('metric shows stored values in the expected units', () {
    expect(metric.weightUnit, 'kg');
    expect(metric.weightFromKg(58.5), 58.5);
    expect(metric.heightUnit, 'cm');
    expect(metric.heightFromCm(165), 165);
    expect(metric.lengthUnit, 'cm');
    expect(metric.lengthFromMm(762), closeTo(76.2, 1e-9));
    expect(metric.speedUnit, 'km/h');
    expect(metric.speedFromKmh(25), 25);
    expect(metric.temperatureUnit, '°C');
    expect(metric.temperatureFromC(30), 30);
  });

  test('imperial converts for display', () {
    expect(imperial.weightUnit, 'lb');
    expect(imperial.weightFromKg(58.5), closeTo(128.97, 0.01));
    expect(imperial.heightUnit, 'in');
    expect(imperial.heightFromCm(165), closeTo(64.96, 0.01));
    expect(imperial.lengthFromMm(762), closeTo(30, 1e-9));
    expect(imperial.speedUnit, 'mph');
    expect(imperial.speedFromKmh(40), closeTo(24.85, 0.01));
    expect(imperial.temperatureUnit, '°F');
    expect(imperial.temperatureFromC(30), closeTo(86, 1e-9));
  });

  test('typing a value and showing it again returns the same value', () {
    for (final units in [metric, imperial]) {
      for (final value in [1.0, 30.0, 64.5, 128.9]) {
        expect(
          units.weightFromKg(units.weightToKg(value)),
          closeTo(value, 1e-9),
        );
        expect(
          units.heightFromCm(units.heightToCm(value)),
          closeTo(value, 1e-9),
        );
        expect(
          units.lengthFromMm(units.lengthToMm(value)),
          closeTo(value, 1e-9),
        );
        expect(
          units.speedFromKmh(units.speedToKmh(value)),
          closeTo(value, 1e-9),
        );
        expect(
          units.temperatureFromC(units.temperatureToC(value)),
          closeTo(value, 1e-9),
        );
      }
    }
  });

  group('formatNumber', () {
    test('drops trailing zeros', () {
      expect(formatNumber(72), '72');
      expect(formatNumber(72.0), '72');
      expect(formatNumber(58.5), '58.5');
      expect(formatNumber(100.0), '100');
      expect(formatNumber(3.10, decimals: 2), '3.1');
    });

    test('rounds to the requested places', () {
      expect(formatNumber(45.584), '45.6');
      expect(formatNumber(45.584, decimals: 0), '46');
      expect(formatNumber(3.077, decimals: 2), '3.08');
      expect(formatNumber(1200, decimals: 0), '1200');
    });
  });
}
