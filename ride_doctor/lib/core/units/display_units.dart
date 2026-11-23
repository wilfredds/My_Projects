import 'package:ride_doctor/core/units/units.dart';

/// Converts between the metric values the app stores and the units a rider
/// chose to read and type. Pure Dart: [metric] is just a flag, so this layer
/// does not depend on the settings feature.
///
/// Unit symbols (kg, lb, cm, in, km/h, mph) are international and are not
/// translated.
final class DisplayUnits {
  const new({required this.metric});

  final bool metric;

  // --- weight: stored kg, shown kg or lb ---
  String get weightUnit => metric ? 'kg' : 'lb';
  double weightFromKg(double kg) => metric ? kg : Units.kgToPounds(kg);
  double weightToKg(double shown) => metric ? shown : Units.poundsToKg(shown);

  // --- height: stored cm, shown cm or in ---
  String get heightUnit => metric ? 'cm' : 'in';
  double heightFromCm(double cm) => metric ? cm : Units.mmToInches(cm * 10);
  double heightToCm(double shown) =>
      metric ? shown : Units.inchesToMm(shown) / 10;

  // --- body and bike lengths: stored mm, shown cm or in ---
  String get lengthUnit => metric ? 'cm' : 'in';
  double lengthFromMm(double mm) => metric ? mm / 10 : Units.mmToInches(mm);
  double lengthToMm(double shown) =>
      metric ? shown * 10 : Units.inchesToMm(shown);

  // --- speed: calculated km/h, shown km/h or mph ---
  String get speedUnit => metric ? 'km/h' : 'mph';
  double speedFromKmh(double kmh) => metric ? kmh : Units.kmToMiles(kmh);
  double speedToKmh(double shown) => metric ? shown : Units.milesToKm(shown);

  // --- temperature: calculated C, shown C or F ---
  String get temperatureUnit => metric ? '°C' : '°F';
  double temperatureFromC(double c) =>
      metric ? c : Units.celsiusToFahrenheit(c);
  double temperatureToC(double shown) =>
      metric ? shown : Units.fahrenheitToCelsius(shown);
}

/// Formats a number for display: at most [decimals] places, and no trailing
/// zeros ("72" not "72.0", "58.5" stays "58.5").
String formatNumber(num value, {int decimals = 1}) {
  final fixed = value.toStringAsFixed(decimals);
  if (!fixed.contains('.')) return fixed;
  return fixed.replaceFirst(RegExp(r'\.?0+$'), '');
}
