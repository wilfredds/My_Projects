import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/core/science/confidence.dart';
import 'package:ride_doctor/core/science/explained.dart';
import 'package:ride_doctor/core/science/power.dart';
import 'package:ride_doctor/core/science/zones.dart';

void main() {
  group('powerZones (Coggan)', () {
    test('boundaries for FTP 200', () {
      // 55% = 110, 75% = 150, 90% = 180, 105% = 210, 120% = 240, 150% = 300.
      final result = powerZones(ftpWatts: 200);
      expect(result.formula, Formula.cogganPowerZones);
      expect(result.confidence, Confidence.measured);
      expect(result.value, const [
        Zone(label: '1', lower: 0, upper: 110),
        Zone(label: '2', lower: 111, upper: 150),
        Zone(label: '3', lower: 151, upper: 180),
        Zone(label: '4', lower: 181, upper: 210),
        Zone(label: '5', lower: 211, upper: 240),
        Zone(label: '6', lower: 241, upper: 300),
        Zone(label: '7', lower: 301),
      ]);
    });

    test('fractional boundaries round down: FTP 250', () {
      // 55% = 137.5 -> level 1 ends at 137; 75% = 187.5 -> 187.
      final zones = powerZones(ftpWatts: 250).value;
      expect(zones[0].upper, 137);
      expect(zones[1], const Zone(label: '2', lower: 138, upper: 187));
      expect(zones[3], const Zone(label: '4', lower: 226, upper: 262));
    });

    test('FTP itself is always in level 4', () {
      for (var ftp = 80; ftp <= 450; ftp++) {
        final level4 = powerZones(ftpWatts: ftp).value[3];
        expect(ftp, inInclusiveRange(level4.lower, level4.upper!));
      }
    });

    test('levels are contiguous for every FTP', () {
      for (var ftp = 80; ftp <= 450; ftp++) {
        final zones = powerZones(ftpWatts: ftp).value;
        for (var i = 0; i + 1 < zones.length; i++) {
          expect(zones[i].upper, zones[i + 1].lower - 1);
        }
      }
    });

    test('rejects a non-positive FTP', () {
      expect(() => powerZones(ftpWatts: 0), throwsArgumentError);
    });
  });

  group('wattsPerKg', () {
    test('divides power by body mass', () {
      final result = wattsPerKg(ftpWatts: 210, massKg: 70);
      expect(result.value, closeTo(3.0, 1e-9));
      expect(result.formula, Formula.wattsPerKg);
    });

    test('rejects a non-positive mass', () {
      expect(() => wattsPerKg(ftpWatts: 200, massKg: 0), throwsArgumentError);
    });
  });
}
