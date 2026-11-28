import 'dart:math' as math;

import 'package:meta/meta.dart';
import 'package:ride_doctor/core/science/heat_index.dart';
import 'package:ride_doctor/features/weather/domain/forecast.dart';

/// How likely rain is, in the bands the app talks about. The cut-offs are
/// our own convention (docs/SCIENCE.md, "Weather").
enum RainLevel { unknown, unlikely, possible, likely }

const rainPossibleFromPercent = 30;
const rainLikelyFromPercent = 60;

RainLevel rainLevelFor(double? chancePercent) {
  if (chancePercent == null) return RainLevel.unknown;
  if (chancePercent >= rainLikelyFromPercent) return RainLevel.likely;
  if (chancePercent >= rainPossibleFromPercent) return RainLevel.possible;
  return RainLevel.unlikely;
}

/// What the weather will be like over one possible ride.
@immutable
final class RideWindow {
  const new({
    required this.start,
    required this.end,
    required this.maxHeatIndexC,
    required this.heatRisk,
    required this.rain,
    required this.thunderstorm,
    this.maxRainChancePercent,
    this.maxUvIndex,
    this.maxGustKmh,
  });

  final DateTime start;
  final DateTime end;

  /// The worst hour decides: a ride is as hot as its hottest hour.
  final double maxHeatIndexC;
  final HeatRisk heatRisk;
  final RainLevel rain;
  final double? maxRainChancePercent;
  final bool thunderstorm;
  final double? maxUvIndex;
  final double? maxGustKmh;

  @override
  String toString() =>
      'RideWindow(${start.hour}:${start.minute.toString().padLeft(2, '0')}'
      '-${end.hour}:${end.minute.toString().padLeft(2, '0')}, '
      '${heatRisk.name}, ${rain.name}${thunderstorm ? ', thunder' : ''})';
}

/// The weather over [start] .. [start] + [durationMinutes]. Null when the
/// forecast does not cover the whole ride.
///
/// Open-Meteo stamps two kinds of value differently (see [HourWeather.time]):
///
/// - Temperature and humidity are moments. The ride's heat is the hottest
///   of every moment from the stamp at or before the start to the stamp at or
///   after the end - the forecast cannot say what happens between two
///   stamps, so both edges count.
/// - Rain chance, gusts and UV describe the hour ending at their stamp. A
///   ride from 06:00 to 07:30 uses the stamps 07:00 (for 06:00-07:00) and
///   08:00 (for 07:00-08:00), not 06:00, which is about 05:00-06:00.
///
/// A thunderstorm in any of those stamps counts, including the hour just
/// before the start: storms linger, and lightning is the one risk the app
/// never trades against heat.
RideWindow? describeWindow({
  required DayWeather day,
  required DateTime start,
  required int durationMinutes,
}) {
  if (durationMinutes <= 0) {
    throw ArgumentError.value(durationMinutes, 'durationMinutes', 'not > 0');
  }
  final end = start.add(Duration(minutes: durationMinutes));
  final byStamp = {for (final hour in day.hours) hour.time: hour};

  // Wall-clock hour arithmetic through the constructor, so a clock change
  // could never shift the stamps.
  DateTime hourAt(DateTime t, int offset) =>
      DateTime(t.year, t.month, t.day, t.hour + offset);
  final firstStamp = hourAt(start, 0);
  final onTheHour = end.minute == 0 && end.second == 0 && end.millisecond == 0;
  final lastStamp = hourAt(end, onTheHour ? 0 : 1);

  final stamps = <HourWeather>[];
  for (var t = firstStamp; !t.isAfter(lastStamp); t = hourAt(t, 1)) {
    final hour = byStamp[t];
    if (hour == null) return null; // a gap: no answer rather than a guess
    stamps.add(hour);
  }
  // The hours the ride is out in end at every stamp after the first.
  final during = stamps.skip(1).toList();

  double? maxOf(double? Function(HourWeather) value) {
    double? result;
    for (final hour in during) {
      final v = value(hour);
      if (v != null) result = result == null ? v : math.max(result, v);
    }
    return result;
  }

  // An hour with unknown rain makes the whole ride's rain unknown, unless
  // another hour already says "likely".
  final rainKnownEverywhere = during.every(
    (hour) => hour.rainChancePercent != null,
  );
  final maxRain = maxOf((hour) => hour.rainChancePercent);
  final rainFromKnown = rainLevelFor(maxRain);
  final rain = rainFromKnown == RainLevel.likely || rainKnownEverywhere
      ? rainFromKnown
      : RainLevel.unknown;

  final maxHeat = stamps.map((hour) => hour.heatIndex).reduce(math.max);
  return RideWindow(
    start: start,
    end: end,
    maxHeatIndexC: maxHeat,
    heatRisk: heatRiskFor(maxHeat),
    rain: rain,
    maxRainChancePercent: maxRain,
    thunderstorm: stamps.any((hour) => hour.thunderstorm),
    maxUvIndex: maxOf((hour) => hour.uvIndex),
    maxGustKmh: maxOf((hour) => hour.gustKmh),
  );
}

/// Without sunrise and sunset from the forecast, assume the day is light
/// from 06:00 to 18:00 - roughly right all year in the Philippines, which
/// is near the equator. Our own fallback.
const fallbackFirstLightHour = 6;
const fallbackLastLightHour = 18;

/// Every ride of [durationMinutes] that starts on the hour, fits within
/// daylight and is fully covered by the forecast, earliest first. With
/// [notBefore] (usually "now"), rides that would already have started are
/// left out.
///
/// Riding in the dark is left out on purpose: for beginners on roads it is
/// the bigger risk than heat.
List<RideWindow> daylightWindows({
  required DayWeather day,
  required int durationMinutes,
  DateTime? notBefore,
}) {
  final date = day.day;
  final light = day.sunrise ?? date.at(fallbackFirstLightHour);
  final dark = day.sunset ?? date.at(fallbackLastLightHour);
  final windows = <RideWindow>[];
  for (var hour = 0; hour < 24; hour++) {
    final start = date.at(hour);
    final end = start.add(Duration(minutes: durationMinutes));
    if (start.isBefore(light) || end.isAfter(dark)) continue;
    if (notBefore != null && start.isBefore(notBefore)) continue;
    final window = describeWindow(
      day: day,
      start: start,
      durationMinutes: durationMinutes,
    );
    if (window != null) windows.add(window);
  }
  return windows;
}

/// The best daylight window: no thunderstorm, then the lowest heat category,
/// then the lowest rain level, then the start nearest [preferredStart], then
/// the coolest. Null when every daylight window has a thunderstorm or the
/// day has no usable forecast.
///
/// This only ranks windows. Whether to move the ride, shorten it or take it
/// indoors is the plan's decision.
RideWindow? bestWindow({
  required List<RideWindow> windows,
  required DateTime preferredStart,
}) {
  final safe = windows.where((window) => !window.thunderstorm).toList();
  if (safe.isEmpty) return null;
  int rainRank(RainLevel level) => switch (level) {
    RainLevel.unlikely => 0,
    RainLevel.unknown => 1,
    RainLevel.possible => 2,
    RainLevel.likely => 3,
  };
  int distance(RideWindow window) =>
      window.start.difference(preferredStart).inMinutes.abs();
  safe.sort((a, b) {
    final byHeat = a.heatRisk.index.compareTo(b.heatRisk.index);
    if (byHeat != 0) return byHeat;
    final byRain = rainRank(a.rain).compareTo(rainRank(b.rain));
    if (byRain != 0) return byRain;
    final byDistance = distance(a).compareTo(distance(b));
    if (byDistance != 0) return byDistance;
    return a.maxHeatIndexC.compareTo(b.maxHeatIndexC);
  });
  return safe.first;
}
