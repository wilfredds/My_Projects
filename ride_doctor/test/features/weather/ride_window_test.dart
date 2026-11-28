import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/core/science/heat_index.dart';
import 'package:ride_doctor/core/time/calendar_day.dart';
import 'package:ride_doctor/features/weather/domain/forecast.dart';
import 'package:ride_doctor/features/weather/domain/ride_window.dart';

final date = CalendarDay(2026, 11, 27);

/// A typical hot Cavite day. (hour, temperature C, humidity %, rain chance %,
/// WMO code). Heat index worked out independently from the NWS algorithm:
/// 06:00 28.0 (caution), 07:00 32.1 (caution), 08:00 35.5 (extreme caution),
/// 12:00 42.2 (danger), 15:00 has a thunderstorm.
const _hours = [
  (0, 25.0, 90.0, 10.0, 1),
  (1, 25.0, 90.0, 10.0, 1),
  (2, 25.0, 90.0, 10.0, 1),
  (3, 25.0, 90.0, 10.0, 1),
  (4, 25.0, 90.0, 10.0, 1),
  (5, 25.0, 90.0, 10.0, 1),
  (6, 26.0, 88.0, 10.0, 1),
  (7, 28.0, 80.0, 10.0, 2),
  (8, 30.0, 72.0, 10.0, 2),
  (9, 31.0, 68.0, 10.0, 2),
  (10, 32.0, 66.0, 10.0, 2),
  (11, 33.0, 62.0, 10.0, 3),
  (12, 34.0, 60.0, 10.0, 3),
  (13, 34.0, 60.0, 40.0, 3),
  (14, 33.0, 65.0, 70.0, 61),
  (15, 31.0, 75.0, 80.0, 95),
  (16, 30.0, 78.0, 30.0, 3),
  (17, 29.0, 80.0, 30.0, 3),
  (18, 28.0, 84.0, 30.0, 3),
  (19, 27.0, 88.0, 20.0, 2),
  (20, 26.0, 90.0, 20.0, 2),
  (21, 26.0, 90.0, 20.0, 2),
  (22, 25.0, 90.0, 20.0, 2),
  (23, 25.0, 90.0, 20.0, 2),
];

DayWeather cavite({
  Set<int> missingHours = const {},
  Map<int, double?> rainOverride = const {},
  Set<int> thunderAt = const {},
  bool withDaylight = true,
}) => DayWeather(
  day: date,
  sunrise: withDaylight ? date.at(5, 45) : null,
  sunset: withDaylight ? date.at(17, 40) : null,
  hours: [
    for (final (hour, temp, humidity, rain, code) in _hours)
      if (!missingHours.contains(hour))
        HourWeather(
          time: date.at(hour),
          temperatureC: temp,
          humidityPercent: humidity,
          rainChancePercent: rainOverride.containsKey(hour)
              ? rainOverride[hour]
              : rain,
          weatherCode: thunderAt.contains(hour) ? 95 : code,
          uvIndex: hour >= 9 && hour <= 15 ? 11 : 2,
          gustKmh: 20,
        ),
  ],
);

void main() {
  group('HourWeather', () {
    test('uses the NWS heat index, not the service apparent temperature', () {
      final noon = cavite().hours[12];
      expect(noon.heatIndex, closeTo(42.18, 0.01));
      expect(noon.heatRisk, HeatRisk.danger);
    });

    test('codes 95, 96, 97 and 99 are thunderstorms, others are not', () {
      HourWeather withCode(int? code) => HourWeather(
        time: date.at(9),
        temperatureC: 30,
        humidityPercent: 70,
        weatherCode: code,
      );
      expect(
        [95, 96, 97, 99].map((c) => withCode(c).thunderstorm),
        everyElement(isTrue),
      );
      expect(
        [0, 61, 80, 82, 94].map((c) => withCode(c).thunderstorm),
        everyElement(isFalse),
      );
      expect(withCode(null).thunderstorm, isFalse);
    });
  });

  group('rainLevelFor', () {
    test('bands at 30% and 60%', () {
      expect(rainLevelFor(null), RainLevel.unknown);
      expect(rainLevelFor(0), RainLevel.unlikely);
      expect(rainLevelFor(29.9), RainLevel.unlikely);
      expect(rainLevelFor(30), RainLevel.possible);
      expect(rainLevelFor(59.9), RainLevel.possible);
      expect(rainLevelFor(60), RainLevel.likely);
      expect(rainLevelFor(100), RainLevel.likely);
    });
  });

  group('describeWindow', () {
    test('the hottest moment decides the heat, both edges included', () {
      // 06:00-07:00: the moments 06:00 (28.0) and 07:00 (32.1).
      final hour = describeWindow(
        day: cavite(),
        start: date.at(6),
        durationMinutes: 60,
      )!;
      expect(hour.maxHeatIndexC, closeTo(32.1, 0.01));
      expect(hour.heatRisk, HeatRisk.caution);

      // 06:00-07:30 is still out at 07:30, between 07:00 (32.1) and 08:00
      // (35.5); the forecast cannot say which, so 08:00 counts too.
      final longer = describeWindow(
        day: cavite(),
        start: date.at(6),
        durationMinutes: 90,
      )!;
      expect(longer.maxHeatIndexC, closeTo(35.5, 0.05));
      expect(longer.heatRisk, HeatRisk.extremeCaution);
      expect(longer.end, date.at(7, 30));
      expect(longer.rain, RainLevel.unlikely);
      expect(longer.thunderstorm, isFalse);
      expect(longer.maxUvIndex, 2);
      expect(longer.maxGustKmh, 20);
    });

    test('rain, gusts and UV are read from the hour that ends at a stamp', () {
      // Rain stamped 07:00 is about 06:00-07:00.
      final day = cavite(rainOverride: {7: 90});
      expect(
        describeWindow(day: day, start: date.at(6), durationMinutes: 60)!.rain,
        RainLevel.likely,
      );
      expect(
        describeWindow(day: day, start: date.at(7), durationMinutes: 60)!.rain,
        RainLevel.unlikely,
      );
      // UV 11 is stamped 09:00-15:00, i.e. 08:00-15:00. A ride from 08:00
      // gets it; a ride ending at 08:00 does not.
      expect(
        describeWindow(
          day: cavite(),
          start: date.at(8),
          durationMinutes: 60,
        )!.maxUvIndex,
        11,
      );
      expect(
        describeWindow(
          day: cavite(),
          start: date.at(7),
          durationMinutes: 60,
        )!.maxUvIndex,
        2,
      );
    });

    test('a storm in the hour before the start still counts', () {
      // Code 95 stamped 07:00 is about 06:00-07:00.
      final window = describeWindow(
        day: cavite(thunderAt: {7}),
        start: date.at(7),
        durationMinutes: 60,
      )!;
      expect(window.thunderstorm, isTrue);
    });

    test('a ride into a storm hour is a thunderstorm ride', () {
      final window = describeWindow(
        day: cavite(),
        start: date.at(14),
        durationMinutes: 120,
      )!;
      expect(window.thunderstorm, isTrue);
      expect(window.rain, RainLevel.likely);
      expect(window.maxRainChancePercent, 80);
    });

    test('a gap in the forecast means no answer, not a guess', () {
      final day = cavite(missingHours: {9});
      expect(
        describeWindow(day: day, start: date.at(9), durationMinutes: 60),
        isNull,
      );
      expect(
        describeWindow(day: day, start: date.at(8), durationMinutes: 90),
        isNull,
      );
      expect(
        describeWindow(day: day, start: date.at(8), durationMinutes: 180),
        isNull,
      );
      // Ends at 09:00, so it needs the 09:00 moment as well.
      expect(
        describeWindow(day: day, start: date.at(7), durationMinutes: 120),
        isNull,
      );
      expect(
        describeWindow(day: day, start: date.at(10), durationMinutes: 60),
        isNotNull,
      );
    });

    test('a ride past the end of the forecast has no answer', () {
      expect(
        describeWindow(day: cavite(), start: date.at(23), durationMinutes: 90),
        isNull,
      );
      // Ending at midnight needs the next day's 00:00 stamp.
      expect(
        describeWindow(day: cavite(), start: date.at(23), durationMinutes: 60),
        isNull,
      );
    });

    test('unknown rain in one hour makes the ride unknown...', () {
      final window = describeWindow(
        day: cavite(rainOverride: {7: null}),
        start: date.at(6),
        durationMinutes: 120,
      )!;
      expect(window.rain, RainLevel.unknown);
    });

    test('...unless another hour already says likely', () {
      final window = describeWindow(
        day: cavite(rainOverride: {14: null}),
        start: date.at(13),
        durationMinutes: 120,
      )!;
      expect(window.rain, RainLevel.likely);
    });

    test('rejects a ride of no length', () {
      expect(
        () => describeWindow(
          day: cavite(),
          start: date.at(6),
          durationMinutes: 0,
        ),
        throwsArgumentError,
      );
    });
  });

  group('daylightWindows', () {
    test('only rides that start on the hour after sunrise and end before '
        'sunset', () {
      final windows = daylightWindows(day: cavite(), durationMinutes: 60);
      // Sunrise 05:45 -> first start 06:00; sunset 17:40 -> last start 16:00.
      expect(windows.first.start, date.at(6));
      expect(windows.last.start, date.at(16));
      expect(windows, hasLength(11));
    });

    test('a longer ride has fewer possible starts', () {
      final windows = daylightWindows(day: cavite(), durationMinutes: 180);
      expect(windows.first.start, date.at(6));
      expect(windows.last.start, date.at(14));
    });

    test('without sunrise and sunset, assumes 06:00 to 18:00', () {
      final windows = daylightWindows(
        day: cavite(withDaylight: false),
        durationMinutes: 60,
      );
      expect(windows.first.start, date.at(6));
      expect(windows.last.start, date.at(17));
    });

    test('leaves out rides that would already have started', () {
      final windows = daylightWindows(
        day: cavite(),
        durationMinutes: 60,
        notBefore: date.at(9, 30),
      );
      expect(windows.first.start, date.at(10));
      expect(windows.last.start, date.at(16));
    });
  });

  group('bestWindow', () {
    List<RideWindow> windows([DayWeather? day]) =>
        daylightWindows(day: day ?? cavite(), durationMinutes: 60);

    test('the preferred early start wins when it is already the coolest', () {
      final best = bestWindow(windows: windows(), preferredStart: date.at(6))!;
      expect(best.start, date.at(6));
      expect(best.heatRisk, HeatRisk.caution);
    });

    test('an afternoon rider is pointed to the cooler morning', () {
      // 16:00 is extreme caution; only 06:00 is caution.
      final best = bestWindow(windows: windows(), preferredStart: date.at(16))!;
      expect(best.start, date.at(6));
      expect(best.heatRisk, HeatRisk.caution);
    });

    test('never suggests a thunderstorm window', () {
      final day = cavite(thunderAt: {6, 7});
      final best = bestWindow(
        windows: windows(day),
        preferredStart: date.at(6),
      )!;
      expect(best.thunderstorm, isFalse);
      expect(best.start.hour, isNot(anyOf(6, 7)));
    });

    test('no window at all when storms last all day', () {
      final day = cavite(thunderAt: {for (var h = 0; h < 24; h++) h});
      expect(
        bestWindow(windows: windows(day), preferredStart: date.at(6)),
        isNull,
      );
    });

    test('between equally hot windows, the drier one wins', () {
      // A storm rules out 06:00. 07:00 and 08:00 are both extreme caution;
      // 07:00 is preferred but rain is likely in its hour (stamped 08:00).
      final day = cavite(thunderAt: {6}, rainOverride: {8: 80});
      final best = bestWindow(
        windows: windows(day),
        preferredStart: date.at(7),
      )!;
      expect(best.start, date.at(8));
      expect(best.heatRisk, HeatRisk.extremeCaution);
      expect(best.rain, RainLevel.unlikely);
    });

    test('no windows in, no window out', () {
      expect(bestWindow(windows: const [], preferredStart: date.at(6)), isNull);
    });
  });

  group('freshnessOf', () {
    final now = DateTime(2026, 11, 27, 12);
    ForecastFreshness at(Duration age) =>
        freshnessOf(fetchedAt: now.subtract(age), now: now);

    test('fresh under an hour, usable under 12 hours, then expired', () {
      expect(at(const Duration(minutes: 59)), ForecastFreshness.fresh);
      expect(at(const Duration(hours: 1)), ForecastFreshness.stale);
      expect(
        at(const Duration(hours: 11, minutes: 59)),
        ForecastFreshness.stale,
      );
      expect(at(const Duration(hours: 12)), ForecastFreshness.expired);
    });

    test('a fetch time in the future (clock moved back) is expired', () {
      expect(at(const Duration(minutes: -5)), ForecastFreshness.expired);
    });
  });

  test('coordinates are rounded to 0.1 degree before storing or sending', () {
    expect(roundCoordinate(14.3299), 14.3);
    expect(roundCoordinate(120.94), 120.9);
    expect(roundCoordinate(121.96), 122.0);
    expect(roundCoordinate(-33.8688), -33.9);
  });

  group('Forecast.dayOf', () {
    test('finds the day or says none', () {
      final forecast = Forecast(
        latitude: 14.3,
        longitude: 120.9,
        fetchedAt: date.at(5),
        days: [cavite()],
      );
      expect(forecast.dayOf(date), isNotNull);
      expect(forecast.dayOf(date.addDays(1)), isNull);
    });
  });

  test('RideWindow describes itself', () {
    final window = describeWindow(
      day: cavite(),
      start: date.at(15),
      durationMinutes: 60,
    )!;
    expect(window.toString(), contains('thunder'));
  });
}
