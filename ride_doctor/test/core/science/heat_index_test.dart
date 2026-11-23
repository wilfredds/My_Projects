import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/core/science/confidence.dart';
import 'package:ride_doctor/core/science/explained.dart';
import 'package:ride_doctor/core/science/heat_index.dart';

void main() {
  group('heatIndexF', () {
    test('Rothfusz regression, worked independently', () {
      // (temperature F, humidity %, heat index F)
      for (final (t, rh, expected) in [
        (90.0, 50.0, 94.60),
        (90.0, 70.0, 105.92),
        (96.0, 65.0, 121.03),
        (100.0, 40.0, 109.26),
        (110.0, 40.0, 135.66),
        (104.0, 60.0, 144.76),
        (82.0, 45.0, 82.07),
      ]) {
        expect(
          heatIndexF(temperatureF: t, humidityPercent: rh),
          closeTo(expected, 0.01),
          reason: '$t F at $rh%',
        );
      }
    });

    test('high-humidity adjustment (RH > 85%, 80-87 F) adds heat', () {
      expect(
        heatIndexF(temperatureF: 86, humidityPercent: 90),
        closeTo(105.39, 0.01),
      );
      expect(
        heatIndexF(temperatureF: 84, humidityPercent: 100),
        closeTo(103.56, 0.01),
      );
    });

    test('the high-humidity adjustment stops above 87 F', () {
      expect(
        heatIndexF(temperatureF: 88, humidityPercent: 85),
        closeTo(109.63, 0.01),
      );
    });

    test('low-humidity adjustment (RH < 13%, 80-112 F) removes heat', () {
      expect(
        heatIndexF(temperatureF: 95, humidityPercent: 10),
        closeTo(89.45, 0.01),
      );
      expect(
        heatIndexF(temperatureF: 100, humidityPercent: 5),
        closeTo(92.50, 0.01),
      );
    });

    test('in mild weather the simple formula applies', () {
      // 0.5 x (70 + 61 + 2.4 + 4.7) = 69.05
      expect(
        heatIndexF(temperatureF: 70, humidityPercent: 50),
        closeTo(69.05, 0.01),
      );
      expect(
        heatIndexF(temperatureF: 75, humidityPercent: 80),
        closeTo(75.96, 0.01),
      );
    });

    test('the regression takes over once the simple value passes 79 F', () {
      // 78 F at 60%: simple value 78.32 - stays simple.
      expect(
        heatIndexF(temperatureF: 78, humidityPercent: 60),
        closeTo(78.32, 0.01),
      );
      // 80 F at 40%: simple value 79.58 - over 79, so the regression: 79.93.
      expect(
        heatIndexF(temperatureF: 80, humidityPercent: 40),
        closeTo(79.93, 0.01),
      );
    });

    test('at or below 40 F the heat index is just the temperature', () {
      expect(heatIndexF(temperatureF: 40, humidityPercent: 50), 40);
      expect(heatIndexF(temperatureF: 35, humidityPercent: 90), 35);
    });

    test('more humidity never feels cooler in riding weather', () {
      for (var t = 80.0; t <= 105; t += 5) {
        for (var rh = 40.0; rh < 100; rh += 5) {
          expect(
            heatIndexF(temperatureF: t, humidityPercent: rh + 5),
            greaterThan(heatIndexF(temperatureF: t, humidityPercent: rh)),
            reason: '$t F, $rh% -> ${rh + 5}%',
          );
        }
      }
    });

    test('rejects impossible humidity', () {
      expect(
        () => heatIndexF(temperatureF: 90, humidityPercent: -1),
        throwsArgumentError,
      );
      expect(
        () => heatIndexF(temperatureF: 90, humidityPercent: 101),
        throwsArgumentError,
      );
    });
  });

  group('heatIndexC', () {
    test('converts in and out of Fahrenheit', () {
      // 30 C = 86 F at 70% -> 95.07 F = 35.04 C.
      final result = heatIndexC(temperatureC: 30, humidityPercent: 70);
      expect(result.value, closeTo(35.04, 0.01));
      expect(result.confidence, Confidence.estimated);
      expect(result.formula, Formula.nwsHeatIndex);
      expect(result.inputs, const [
        Input(Quantity.temperatureC, 30),
        Input(Quantity.humidityPercent, 70),
      ]);
    });

    test('typical Philippine afternoons', () {
      expect(
        heatIndexC(temperatureC: 33, humidityPercent: 60).value,
        closeTo(39.52, 0.01),
      );
      expect(
        heatIndexC(temperatureC: 32, humidityPercent: 80).value,
        closeTo(44.37, 0.01),
      );
      expect(
        heatIndexC(temperatureC: 35, humidityPercent: 75).value,
        closeTo(53.33, 0.01),
      );
    });
  });

  group('heatRiskFor (PAGASA categories)', () {
    test('each band, at both of its edges', () {
      expect(heatRiskFor(26), HeatRisk.notHazardous);
      expect(heatRiskFor(27), HeatRisk.caution);
      expect(heatRiskFor(32), HeatRisk.caution);
      expect(heatRiskFor(33), HeatRisk.extremeCaution);
      expect(heatRiskFor(41), HeatRisk.extremeCaution);
      expect(heatRiskFor(42), HeatRisk.danger);
      expect(heatRiskFor(51), HeatRisk.danger);
      expect(heatRiskFor(52), HeatRisk.extremeDanger);
      expect(heatRiskFor(60), HeatRisk.extremeDanger);
    });

    test('fractions round to the nearest whole degree first', () {
      expect(heatRiskFor(26.4), HeatRisk.notHazardous);
      expect(heatRiskFor(26.5), HeatRisk.caution);
      expect(heatRiskFor(32.4), HeatRisk.caution);
      expect(heatRiskFor(32.5), HeatRisk.extremeCaution);
      expect(heatRiskFor(41.6), HeatRisk.danger);
      expect(heatRiskFor(51.5), HeatRisk.extremeDanger);
    });

    test('the worked afternoons land in the expected categories', () {
      HeatRisk risk(double c, double rh) =>
          heatRiskFor(heatIndexC(temperatureC: c, humidityPercent: rh).value);
      expect(risk(26, 50), HeatRisk.notHazardous);
      expect(risk(30, 70), HeatRisk.extremeCaution);
      expect(risk(32, 80), HeatRisk.danger);
      expect(risk(35, 75), HeatRisk.extremeDanger);
    });
  });
}
