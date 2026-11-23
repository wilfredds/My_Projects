import 'package:ride_doctor/core/science/confidence.dart';
import 'package:ride_doctor/core/science/constants.dart';
import 'package:ride_doctor/core/science/explained.dart';
import 'package:ride_doctor/core/science/zones.dart';

/// Age in whole years from a birth year. We ask for the year only (less
/// personal than a birth date), so this can be one year high before the
/// rider's birthday. For the Tanaka estimate that is 0.7 bpm - far inside the
/// formula's own error - so it does not lower the confidence of anything.
int ageFromBirthYear({required int birthYear, required int currentYear}) {
  if (birthYear > currentYear) {
    throw ArgumentError.value(birthYear, 'birthYear', 'is in the future');
  }
  return currentYear - birthYear;
}

/// Maximum heart rate: the rider's own measurement if there is one, otherwise
/// the Tanaka age-based estimate (SCIENCE.md 7.2).
Explained<int> maxHeartRate({required int ageYears, int? measuredBpm}) {
  if (measuredBpm != null) {
    return Explained(
      value: measuredBpm,
      confidence: Confidence.measured,
      formula: Formula.measuredMaxHr,
      inputs: [Input(Quantity.maxHeartRateBpm, measuredBpm)],
    );
  }
  return Explained(
    value: (tanakaIntercept - tanakaSlopePerYear * ageYears).round(),
    confidence: Confidence.estimated,
    formula: Formula.tanakaMaxHr,
    inputs: [Input(Quantity.ageYears, ageYears)],
    improvements: const [Improvement.measureMaxHr],
  );
}

/// Heart-rate training zones by the best method the rider's data allows
/// (SCIENCE.md 7.3):
///
/// 1. Lactate-threshold heart rate known -> Friel's seven cycling zones.
///    Measured: it comes from the rider's own field test.
/// 2. Resting heart rate known -> five zones of heart-rate reserve (Karvonen).
/// 3. Otherwise -> five zones as a percentage of maximum heart rate.
///
/// For 2 and 3 the zone *bands* are a convention, not something tested on this
/// rider, so the result is never better than Estimated - and it drops to Rough
/// when the maximum itself is only an age-based estimate, because that is an
/// estimate stacked on an estimate.
Explained<List<Zone>> heartRateZones({
  required Explained<int> maxHr,
  int? restingBpm,
  int? lthrBpm,
}) {
  if (lthrBpm != null) {
    final lowers = [
      for (final percent in frielLowerPercents)
        percentOfRounded(lthrBpm, percent),
      // 5c is strictly above 106%, so it starts one beat after the last beat
      // that is still within 106%.
      lthrBpm * frielZone5bUpperPercent ~/ 100 + 1,
    ];
    return Explained(
      value: [
        Zone(label: '1', lower: 0, upper: lowers.first - 1),
        ...zonesFromLowerBounds(
          const ['2', '3', '4', '5a', '5b', '5c'],
          lowers,
          topUpper: null,
        ),
      ],
      confidence: Confidence.measured,
      formula: Formula.frielLthrZones,
      inputs: [Input(Quantity.lthrBpm, lthrBpm)],
    );
  }

  final bandConfidence = maxHr.confidence == Confidence.measured
      ? Confidence.estimated
      : Confidence.rough;
  const labels = ['1', '2', '3', '4', '5'];

  if (restingBpm != null) {
    if (restingBpm >= maxHr.value) {
      throw ArgumentError.value(
        restingBpm,
        'restingBpm',
        'must be below the maximum heart rate (${maxHr.value})',
      );
    }
    final reserve = maxHr.value - restingBpm;
    return Explained(
      value: zonesFromLowerBounds(labels, [
        for (final percent in fiveZoneLowerPercents)
          restingBpm + percentOfRounded(reserve, percent),
      ], topUpper: maxHr.value),
      confidence: bandConfidence,
      formula: Formula.karvonenZones,
      inputs: [
        Input(Quantity.restingHeartRateBpm, restingBpm),
        Input(Quantity.maxHeartRateBpm, maxHr.value),
      ],
      improvements: [
        if (maxHr.confidence != Confidence.measured) Improvement.measureMaxHr,
        Improvement.doLthrTest,
      ],
    );
  }

  return Explained(
    value: zonesFromLowerBounds(labels, [
      for (final percent in fiveZoneLowerPercents)
        percentOfRounded(maxHr.value, percent),
    ], topUpper: maxHr.value),
    confidence: bandConfidence,
    formula: Formula.percentMaxHrZones,
    inputs: [Input(Quantity.maxHeartRateBpm, maxHr.value)],
    improvements: [
      if (maxHr.confidence != Confidence.measured) Improvement.measureMaxHr,
      Improvement.measureRestingHr,
      Improvement.doLthrTest,
    ],
  );
}
