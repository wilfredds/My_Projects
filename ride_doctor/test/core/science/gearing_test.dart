import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/core/science/gearing.dart';

void main() {
  group('golden values from the spec (2.10 m wheel, 8 km/h)', () {
    test('39x28 -> about 45.6 rpm', () {
      const gear = Gear(chainring: 39, cog: 28);
      expect(
        gear.cadenceRpm(speedKmh: 8, circumferenceMm: 2100),
        closeTo(45.6, 0.05),
      );
    });

    test('34x32 -> about 59.8 rpm', () {
      const gear = Gear(chainring: 34, cog: 32);
      expect(
        gear.cadenceRpm(speedKmh: 8, circumferenceMm: 2100),
        closeTo(59.8, 0.05),
      );
    });
  });

  group('Gear', () {
    const gear = Gear(chainring: 39, cog: 28);

    test('ratio is chainring over cog', () {
      expect(gear.ratio, closeTo(1.392857, 1e-6));
      expect(const Gear(chainring: 34, cog: 34).ratio, 1);
    });

    test('development is ratio x circumference, in metres', () {
      expect(gear.developmentM(2100), closeTo(2.925, 1e-9));
    });

    test('speed and cadence are inverses of each other', () {
      for (final speed in [5.0, 8.0, 12.5, 25.0, 40.0]) {
        final cadence = gear.cadenceRpm(speedKmh: speed, circumferenceMm: 2111);
        expect(
          gear.speedKmh(cadenceRpm: cadence, circumferenceMm: 2111),
          closeTo(speed, 1e-9),
        );
      }
    });

    test('the reference road bike: 34x34 on 700x25C at 8 km/h is 63.2 rpm', () {
      // pi x 672 = 2111.15 mm; development 2.1112 m; 133.33 / 2.1112.
      expect(
        const Gear(
          chainring: 34,
          cog: 34,
        ).cadenceRpm(speedKmh: 8, circumferenceMm: 2111.15),
        closeTo(63.16, 0.01),
      );
    });

    test('top gear 50x11 at 40 km/h is 69.5 rpm', () {
      expect(
        const Gear(
          chainring: 50,
          cog: 11,
        ).cadenceRpm(speedKmh: 40, circumferenceMm: 2111.15),
        closeTo(69.47, 0.01),
      );
    });

    test('has value equality and a readable description', () {
      expect(gear, const Gear(chainring: 39, cog: 28));
      expect(gear.hashCode, const Gear(chainring: 39, cog: 28).hashCode);
      expect(gear.toString(), '39x28');
    });
  });

  group('allGears', () {
    test('lists every combination, easiest first', () {
      final gears = allGears(chainrings: [50, 34], cogs: [11, 34, 21]);
      expect(gears, hasLength(6));
      expect(gears.first, const Gear(chainring: 34, cog: 34));
      expect(gears.last, const Gear(chainring: 50, cog: 11));
      for (var i = 0; i + 1 < gears.length; i++) {
        expect(gears[i].ratio, lessThanOrEqualTo(gears[i + 1].ratio));
      }
    });
  });

  group('estimateCogs', () {
    test('keeps the smallest and largest cogs exact', () {
      for (final speeds in [8, 9, 10, 11, 12]) {
        final cogs = estimateCogs(smallest: 11, largest: 34, speeds: speeds);
        expect(cogs, hasLength(speeds));
        expect(cogs.first, 11);
        expect(cogs.last, 34);
      }
    });

    test('cogs strictly increase, even for a tight range', () {
      for (final (smallest, largest, speeds) in [
        (11, 34, 10),
        (11, 25, 10),
        (12, 25, 10),
        (11, 23, 11),
        (10, 52, 12),
        (11, 21, 11),
      ]) {
        final cogs = estimateCogs(
          smallest: smallest,
          largest: largest,
          speeds: speeds,
        );
        expect(cogs.first, smallest);
        expect(cogs.last, largest);
        for (var i = 0; i + 1 < cogs.length; i++) {
          expect(
            cogs[i],
            lessThan(cogs[i + 1]),
            reason: '$smallest-$largest $speeds-speed gave $cogs',
          );
        }
      }
    });

    test('a range with exactly one cog per tooth is every tooth', () {
      expect(estimateCogs(smallest: 11, largest: 15, speeds: 5), [
        11,
        12,
        13,
        14,
        15,
      ]);
    });

    test('cassetteFits says which ranges are possible', () {
      expect(cassetteFits(smallest: 11, largest: 34, speeds: 10), isTrue);
      expect(cassetteFits(smallest: 11, largest: 15, speeds: 5), isTrue);
      expect(cassetteFits(smallest: 11, largest: 15, speeds: 6), isFalse);
      expect(cassetteFits(smallest: 34, largest: 11, speeds: 10), isFalse);
      expect(cassetteFits(smallest: 0, largest: 11, speeds: 5), isFalse);
      expect(cassetteFits(smallest: 11, largest: 34, speeds: 1), isFalse);
    });

    test('rejects impossible cassettes', () {
      expect(
        () => estimateCogs(smallest: 34, largest: 11, speeds: 10),
        throwsArgumentError,
      );
      expect(
        () => estimateCogs(smallest: 11, largest: 13, speeds: 10),
        throwsArgumentError,
      );
      expect(
        () => estimateCogs(smallest: 11, largest: 34, speeds: 1),
        throwsArgumentError,
      );
    });
  });
}
