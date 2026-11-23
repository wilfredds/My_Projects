import 'dart:math' as math;

import 'package:ride_doctor/core/science/confidence.dart';
import 'package:ride_doctor/core/science/constants.dart';
import 'package:ride_doctor/core/science/explained.dart';
import 'package:ride_doctor/core/units/units.dart';

/// Heat index in degrees Fahrenheit by the US National Weather Service
/// procedure (SCIENCE.md 7.10). The published equation is in Fahrenheit, so it
/// is implemented in Fahrenheit and converted at the edges - re-deriving the
/// coefficients for Celsius would be a place to introduce errors for nothing.
double heatIndexF({
  required double temperatureF,
  required double humidityPercent,
}) {
  if (humidityPercent < 0 || humidityPercent > 100) {
    throw ArgumentError.value(
      humidityPercent,
      'humidityPercent',
      'must be between 0 and 100',
    );
  }
  final t = temperatureF;
  final rh = humidityPercent;

  // Step 1: the simple formula, averaged with the air temperature. Below 80 F
  // this is the answer.
  final simple = 0.5 * (t + 61.0 + ((t - 68.0) * 1.2) + (rh * 0.094));
  final mild = (simple + t) / 2;
  if (mild < 80) return mild;

  // Step 2: the full Rothfusz regression.
  var index =
      -42.379 +
      2.04901523 * t +
      10.14333127 * rh -
      0.22475541 * t * rh -
      0.00683783 * t * t -
      0.05481717 * rh * rh +
      0.00122874 * t * t * rh +
      0.00085282 * t * rh * rh -
      0.00000199 * t * t * rh * rh;

  // Step 3: corrections at the humidity extremes.
  if (rh < 13 && t >= 80 && t <= 112) {
    index -= ((13 - rh) / 4) * math.sqrt((17 - (t - 95).abs()) / 17);
  } else if (rh > 85 && t >= 80 && t <= 87) {
    index += ((rh - 85) / 10) * ((87 - t) / 5);
  }
  return index;
}

/// Heat index in degrees Celsius. Estimated: it is a formula, and it describes
/// shade with a light wind - direct sun can add several degrees.
Explained<double> heatIndexC({
  required double temperatureC,
  required double humidityPercent,
}) => Explained(
  value: Units.fahrenheitToCelsius(
    heatIndexF(
      temperatureF: Units.celsiusToFahrenheit(temperatureC),
      humidityPercent: humidityPercent,
    ),
  ),
  confidence: Confidence.estimated,
  formula: Formula.nwsHeatIndex,
  inputs: [
    Input(Quantity.temperatureC, temperatureC),
    Input(Quantity.humidityPercent, humidityPercent),
  ],
);

/// PAGASA's heat-index categories, mildest first.
enum HeatRisk { notHazardous, caution, extremeCaution, danger, extremeDanger }

/// The PAGASA category for a heat index in degrees Celsius.
///
/// PAGASA publishes the bands in whole degrees (27-32, 33-41, 42-51, 52+),
/// which leaves 32.5 undefined. We round to the nearest whole degree first,
/// the way the published figure a rider would compare against is rounded.
HeatRisk heatRiskFor(double heatIndexCelsius) {
  final rounded = heatIndexCelsius.round();
  if (rounded >= pagasaExtremeDangerFromC) return HeatRisk.extremeDanger;
  if (rounded >= pagasaDangerFromC) return HeatRisk.danger;
  if (rounded >= pagasaExtremeCautionFromC) return HeatRisk.extremeCaution;
  if (rounded >= pagasaCautionFromC) return HeatRisk.caution;
  return HeatRisk.notHazardous;
}
