import 'package:meta/meta.dart';
import 'package:ride_doctor/core/science/heat_index.dart';
import 'package:ride_doctor/core/time/calendar_day.dart';

/// WMO weather codes for thunderstorms as Open-Meteo documents them (95:
/// thunderstorm; 96 and 99: with hail; 97: heavy thunderstorm). Lightning
/// makes riding outdoors unsafe whatever the heat or rain.
const Set<int> thunderstormCodes = {95, 96, 97, 99};

/// One hour of forecast at the rider's town.
///
/// Values are as the weather service reports them, in metric units. Anything
/// but the time, temperature and humidity may be missing: a service can
/// leave a variable out for some hours, and "unknown" must never be read as
/// "zero" - an unknown rain chance is not a 0% rain chance.
@immutable
final class HourWeather {
  const new({
    required this.time,
    required this.temperatureC,
    required this.humidityPercent,
    this.rainChancePercent,
    this.precipitationMm,
    this.windKmh,
    this.gustKmh,
    this.uvIndex,
    this.weatherCode,
  });

  /// The forecast's time stamp, as wall-clock time at the town.
  ///
  /// Open-Meteo reports two kinds of value against it: temperature and
  /// humidity are the values AT this moment; rain chance, rainfall, gusts,
  /// UV and the weather code describe the hour that ENDS at this moment.
  /// `describeWindow` (ride_window.dart) reads each kind accordingly.
  final DateTime time;
  final double temperatureC;
  final double humidityPercent;
  final double? rainChancePercent;
  final double? precipitationMm;
  final double? windKmh;
  final double? gustKmh;
  final double? uvIndex;
  final int? weatherCode;

  /// How hot it feels, by the same NWS heat index the rest of the app uses
  /// (docs/SCIENCE.md 7.10) - not the service's own "apparent temperature",
  /// which is a different formula and would disagree with PAGASA's bands.
  double get heatIndex => heatIndexC(
    temperatureC: temperatureC,
    humidityPercent: humidityPercent,
  ).value;

  HeatRisk get heatRisk => heatRiskFor(heatIndex);

  bool get thunderstorm =>
      weatherCode != null && thunderstormCodes.contains(weatherCode);
}

/// One day of forecast: its hours in time order, and daylight if known.
@immutable
final class DayWeather {
  const new({
    required this.day,
    required this.hours,
    this.sunrise,
    this.sunset,
  });

  final CalendarDay day;
  final List<HourWeather> hours;
  final DateTime? sunrise;
  final DateTime? sunset;
}

/// A forecast for one place, as fetched at [fetchedAt].
@immutable
final class Forecast {
  const new({
    required this.latitude,
    required this.longitude,
    required this.fetchedAt,
    required this.days,
    this.timezone,
  });

  final double latitude;
  final double longitude;

  /// IANA time zone of the place, e.g. "Asia/Manila", if the service said.
  final String? timezone;

  /// When it was fetched, by the phone's clock.
  final DateTime fetchedAt;

  /// Days in date order.
  final List<DayWeather> days;

  DayWeather? dayOf(CalendarDay day) {
    for (final candidate in days) {
      if (candidate.day == day) return candidate;
    }
    return null;
  }
}

/// How old a stored forecast may be for each use. Our own convention
/// (docs/SCIENCE.md, "Weather"): forecasts change through the day, and a
/// rider deciding when to leave needs a recent one; an older one is still
/// better than nothing when there is no signal, if it is labelled.
abstract final class ForecastAge {
  /// Younger than this: use it, no need to fetch.
  static const fresh = Duration(hours: 1);

  /// Younger than this: if fetching fails, show it marked "not up to date".
  static const usable = Duration(hours: 12);
}

enum ForecastFreshness { fresh, stale, expired }

ForecastFreshness freshnessOf({
  required DateTime fetchedAt,
  required DateTime now,
}) {
  final age = now.difference(fetchedAt);
  // A fetch time in the future means the phone's clock moved backwards;
  // treat the data as old rather than trusting it forever.
  if (age.isNegative) return ForecastFreshness.expired;
  if (age < ForecastAge.fresh) return ForecastFreshness.fresh;
  if (age < ForecastAge.usable) return ForecastFreshness.stale;
  return ForecastFreshness.expired;
}

/// Coordinates are rounded to this many decimal places before they are
/// stored or sent: 0.1 degree is about 11 km, enough for a town's weather
/// and no more precise than the town itself (privacy by design, PROMPT.md
/// section 10). Our own choice.
const coordinateDecimals = 1;

double roundCoordinate(double degrees) {
  const factor = 10; // 10^coordinateDecimals
  return (degrees * factor).roundToDouble() / factor;
}
