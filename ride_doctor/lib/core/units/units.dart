/// Unit conversions. Everything is stored and calculated in metric; these are
/// used only at the edges, when reading input or showing a result.
///
/// The factors are exact by international definition (the pound and the inch
/// are defined in terms of the kilogram and the metre).
abstract final class Units {
  static const double kgPerPound = 0.45359237;
  static const double mmPerInch = 25.4;
  static const double kmPerMile = 1.609344;
  static const double kPaPerPsi = 6.894757293168;

  static double poundsToKg(double pounds) => pounds * kgPerPound;
  static double kgToPounds(double kg) => kg / kgPerPound;

  static double inchesToMm(double inches) => inches * mmPerInch;
  static double mmToInches(double mm) => mm / mmPerInch;

  static double milesToKm(double miles) => miles * kmPerMile;
  static double kmToMiles(double km) => km / kmPerMile;

  static double fahrenheitToCelsius(double f) => (f - 32) * 5 / 9;
  static double celsiusToFahrenheit(double c) => c * 9 / 5 + 32;

  static double psiToBar(double psi) => psi * kPaPerPsi / 100;
  static double barToPsi(double bar) => bar * 100 / kPaPerPsi;
}
