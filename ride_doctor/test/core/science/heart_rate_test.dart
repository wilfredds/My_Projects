import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/core/science/confidence.dart';
import 'package:ride_doctor/core/science/explained.dart';
import 'package:ride_doctor/core/science/heart_rate.dart';
import 'package:ride_doctor/core/science/zones.dart';

/// Checks the property that makes zones usable: every whole value from the
/// bottom of the first zone upward belongs to exactly one zone.
void expectContiguous(List<Zone> zones) {
  for (var i = 0; i + 1 < zones.length; i++) {
    expect(
      zones[i].upper,
      zones[i + 1].lower - 1,
      reason: 'gap or overlap between zone ${zones[i].label} and the next',
    );
    expect(zones[i].lower, lessThanOrEqualTo(zones[i].upper!));
  }
}

void main() {
  group('ageFromBirthYear', () {
    test('is the difference in years', () {
      expect(ageFromBirthYear(birthYear: 2004, currentYear: 2026), 22);
      expect(ageFromBirthYear(birthYear: 2026, currentYear: 2026), 0);
    });

    test('rejects a birth year in the future', () {
      expect(
        () => ageFromBirthYear(birthYear: 2030, currentYear: 2026),
        throwsArgumentError,
      );
    });
  });

  group('maxHeartRate', () {
    test('Tanaka: 208 - 0.7 x age, rounded', () {
      // 208 - 15.4 = 192.6; 208 - 28 = 180; 208 - 42 = 166.
      expect(maxHeartRate(ageYears: 22).value, 193);
      expect(maxHeartRate(ageYears: 40).value, 180);
      expect(maxHeartRate(ageYears: 60).value, 166);
    });

    test('an estimate is Estimated and says how to improve it', () {
      final result = maxHeartRate(ageYears: 22);
      expect(result.confidence, Confidence.estimated);
      expect(result.formula, Formula.tanakaMaxHr);
      expect(result.inputs, const [Input(Quantity.ageYears, 22)]);
      expect(result.improvements, contains(Improvement.measureMaxHr));
    });

    test('a measured value wins over the estimate and is Measured', () {
      final result = maxHeartRate(ageYears: 22, measuredBpm: 201);
      expect(result.value, 201);
      expect(result.confidence, Confidence.measured);
      expect(result.formula, Formula.measuredMaxHr);
      expect(result.improvements, isEmpty);
    });
  });

  group('heartRateZones - Friel (LTHR known)', () {
    final result = heartRateZones(
      maxHr: maxHeartRate(ageYears: 22),
      restingBpm: 55,
      lthrBpm: 160,
    );

    test('uses LTHR even when resting HR is also known', () {
      expect(result.formula, Formula.frielLthrZones);
      expect(result.confidence, Confidence.measured);
    });

    test('boundaries for LTHR 160', () {
      // 81% = 129.6 -> 130; 90% = 144; 94% = 150.4 -> 150; 100% = 160;
      // 103% = 164.8 -> 165; 106% = 169.6, so 5c starts at 170.
      expect(result.value, const [
        Zone(label: '1', lower: 0, upper: 129),
        Zone(label: '2', lower: 130, upper: 143),
        Zone(label: '3', lower: 144, upper: 149),
        Zone(label: '4', lower: 150, upper: 159),
        Zone(label: '5a', lower: 160, upper: 164),
        Zone(label: '5b', lower: 165, upper: 169),
        Zone(label: '5c', lower: 170),
      ]);
    });

    test('zones are contiguous for every plausible LTHR', () {
      for (var lthr = 100; lthr <= 210; lthr++) {
        final zones = heartRateZones(
          maxHr: maxHeartRate(ageYears: 30),
          lthrBpm: lthr,
        ).value;
        expectContiguous(zones);
        expect(zones.last.upper, isNull);
        // Zone 5a starts exactly at threshold.
        expect(zones[4].lower, lthr);
      }
    });

    test('a half-beat boundary rounds up, not down', () {
      // 90% of 145 is exactly 130.5. Floating point would put it at
      // 130.49999... and round down; integer arithmetic must give 131.
      final zones = heartRateZones(
        maxHr: maxHeartRate(ageYears: 30),
        lthrBpm: 145,
      ).value;
      expect(zones[2].lower, 131);
    });
  });

  group('heartRateZones - Karvonen (resting HR known)', () {
    test('boundaries for rest 60, max 190', () {
      // Reserve 130: 60 + 65, + 78, + 91, + 104, + 117.
      final result = heartRateZones(
        maxHr: maxHeartRate(ageYears: 30, measuredBpm: 190),
        restingBpm: 60,
      );
      expect(result.formula, Formula.karvonenZones);
      expect(result.value, const [
        Zone(label: '1', lower: 125, upper: 137),
        Zone(label: '2', lower: 138, upper: 150),
        Zone(label: '3', lower: 151, upper: 163),
        Zone(label: '4', lower: 164, upper: 176),
        Zone(label: '5', lower: 177, upper: 190),
      ]);
    });

    test('measured maximum -> Estimated; estimated maximum -> Rough', () {
      expect(
        heartRateZones(
          maxHr: maxHeartRate(ageYears: 30, measuredBpm: 190),
          restingBpm: 60,
        ).confidence,
        Confidence.estimated,
      );
      final onEstimate = heartRateZones(
        maxHr: maxHeartRate(ageYears: 30),
        restingBpm: 60,
      );
      expect(onEstimate.confidence, Confidence.rough);
      expect(onEstimate.improvements, contains(Improvement.measureMaxHr));
    });

    test('rejects a resting HR at or above the maximum', () {
      expect(
        () => heartRateZones(
          maxHr: maxHeartRate(ageYears: 30, measuredBpm: 150),
          restingBpm: 150,
        ),
        throwsArgumentError,
      );
    });

    test('zones are contiguous and end at the maximum', () {
      for (var rest = 35; rest <= 100; rest += 5) {
        final zones = heartRateZones(
          maxHr: maxHeartRate(ageYears: 30, measuredBpm: 185),
          restingBpm: rest,
        ).value;
        expectContiguous(zones);
        expect(zones.last.upper, 185);
      }
    });
  });

  group('heartRateZones - percent of maximum (nothing else known)', () {
    test('boundaries for max 190', () {
      final result = heartRateZones(
        maxHr: maxHeartRate(ageYears: 30, measuredBpm: 190),
      );
      expect(result.formula, Formula.percentMaxHrZones);
      expect(result.value, const [
        Zone(label: '1', lower: 95, upper: 113),
        Zone(label: '2', lower: 114, upper: 132),
        Zone(label: '3', lower: 133, upper: 151),
        Zone(label: '4', lower: 152, upper: 170),
        Zone(label: '5', lower: 171, upper: 190),
      ]);
    });

    test(
      'a phone-only beginner gets Rough zones and three ways to improve',
      () {
        final result = heartRateZones(maxHr: maxHeartRate(ageYears: 22));
        expect(result.confidence, Confidence.rough);
        expect(result.improvements, const [
          Improvement.measureMaxHr,
          Improvement.measureRestingHr,
          Improvement.doLthrTest,
        ]);
      },
    );
  });

  test('Zone has value equality and a readable description', () {
    const zone = Zone(label: '2', lower: 130, upper: 143);
    expect(zone, const Zone(label: '2', lower: 130, upper: 143));
    expect(
      zone.hashCode,
      const Zone(label: '2', lower: 130, upper: 143).hashCode,
    );
    expect(zone.toString(), 'Z2[130..143]');
    expect(const Zone(label: '7', lower: 301).toString(), 'Z7[301..]');
  });

  test('Confidence.weakest picks the least trustworthy', () {
    expect(
      Confidence.weakest([Confidence.measured, Confidence.estimated]),
      Confidence.estimated,
    );
    expect(
      Confidence.weakest([Confidence.rough, Confidence.measured]),
      Confidence.rough,
    );
    expect(Confidence.weakest([Confidence.measured]), Confidence.measured);
  });

  test('Input has value equality and a readable description', () {
    const input = Input(Quantity.ageYears, 22);
    expect(input, const Input(Quantity.ageYears, 22));
    expect(input.hashCode, const Input(Quantity.ageYears, 22).hashCode);
    expect(input.toString(), 'ageYears=22');
  });
}
