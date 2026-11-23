import 'package:ride_doctor/core/science/confidence.dart';
import 'package:ride_doctor/core/science/constants.dart';
import 'package:ride_doctor/core/science/explained.dart';
import 'package:ride_doctor/core/science/zones.dart';

/// Coggan's seven power levels from functional threshold power
/// (SCIENCE.md 7.4). Measured, because FTP only exists if the rider tested it.
Explained<List<Zone>> powerZones({required int ftpWatts}) {
  if (ftpWatts <= 0) {
    throw ArgumentError.value(ftpWatts, 'ftpWatts', 'must be positive');
  }
  // Each level tops out at a percentage of FTP inclusive, so the next level
  // starts one watt above it.
  final uppers = [
    for (final percent in cogganUpperPercents) ftpWatts * percent ~/ 100,
  ];
  return Explained(
    value: [
      Zone(label: '1', lower: 0, upper: uppers.first),
      for (var i = 1; i < uppers.length; i++)
        Zone(label: '${i + 1}', lower: uppers[i - 1] + 1, upper: uppers[i]),
      Zone(label: '7', lower: uppers.last + 1),
    ],
    confidence: Confidence.measured,
    formula: Formula.cogganPowerZones,
    inputs: [Input(Quantity.ftpWatts, ftpWatts)],
  );
}

/// Power-to-weight ratio in W/kg: what decides climbing speed.
Explained<double> wattsPerKg({required int ftpWatts, required double massKg}) {
  if (massKg <= 0) {
    throw ArgumentError.value(massKg, 'massKg', 'must be positive');
  }
  return Explained(
    value: ftpWatts / massKg,
    confidence: Confidence.measured,
    formula: Formula.wattsPerKg,
    inputs: [
      Input(Quantity.ftpWatts, ftpWatts),
      Input(Quantity.massKg, massKg),
    ],
  );
}
