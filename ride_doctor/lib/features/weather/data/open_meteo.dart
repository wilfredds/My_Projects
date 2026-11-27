import 'package:ride_doctor/core/network/json_http.dart';
import 'package:ride_doctor/core/time/calendar_day.dart';
import 'package:ride_doctor/features/weather/domain/forecast.dart';
import 'package:ride_doctor/features/weather/domain/place.dart';

/// Open-Meteo, the weather service (docs/DECISIONS.md, ADR-0007: behind this
/// one file, so it can be swapped). Free for non-commercial use; its data
/// must be credited. Everything that comes back is checked before use.

/// The hourly variables the app asks for, in Open-Meteo's names.
const forecastHourlyVariables = [
  'temperature_2m',
  'relative_humidity_2m',
  'precipitation_probability',
  'precipitation',
  'wind_speed_10m',
  'wind_gusts_10m',
  'uv_index',
  'weather_code',
];

/// Days of forecast requested: a week covers the plan the app shows.
const forecastDays = 7;

Uri forecastUri({required double latitude, required double longitude}) =>
    Uri.https('api.open-meteo.com', '/v1/forecast', {
      // Rounded again here so no caller can send more precision than that.
      'latitude': roundCoordinate(latitude).toString(),
      'longitude': roundCoordinate(longitude).toString(),
      'hourly': forecastHourlyVariables.join(','),
      'daily': 'sunrise,sunset',
      // Times come back as wall-clock time at the place.
      'timezone': 'auto',
      'forecast_days': '$forecastDays',
    });

/// A town search. [query] is what the rider typed; it is trimmed and cut to
/// 60 characters, and control characters are removed, before it is sent.
Uri geocodingUri(String query) =>
    Uri.https('geocoding-api.open-meteo.com', '/v1/search', {
      'name': cleanPlaceQuery(query),
      'count': '10',
      'language': 'en',
      'format': 'json',
    });

String cleanPlaceQuery(String query) {
  final cleaned = query.replaceAll(RegExp(r'[\x00-\x1F\x7F]'), '').trim();
  return cleaned.length > 60 ? cleaned.substring(0, 60) : cleaned;
}

/// The smallest query worth sending.
const minPlaceQueryLength = 2;

/// Reads a forecast answer. Throws [FormatException] when its structure is
/// wrong (missing or mismatched arrays, unreadable times): a half-read
/// forecast is worse than none. Single implausible values - a humidity of
/// 140%, a negative wind - are treated as unknown instead, and an hour
/// without a usable temperature and humidity is left out, because its heat
/// cannot be judged.
Forecast parseForecast(
  Map<String, Object?> json, {
  required DateTime fetchedAt,
}) {
  final latitude = _number(json['latitude'], 'latitude', -90, 90);
  final longitude = _number(json['longitude'], 'longitude', -180, 180);
  final timezone = json['timezone'];

  final hourly = _object(json['hourly'], 'hourly');
  final times = _strings(hourly['time'], 'hourly.time');
  if (times.length > 16 * 24) {
    throw const FormatException('too many hours');
  }
  List<Object?> column(String name) {
    final values = hourly[name];
    if (values == null) return List.filled(times.length, null);
    if (values is! List<Object?> || values.length != times.length) {
      throw FormatException('hourly.$name does not match hourly.time');
    }
    return values;
  }

  final temperature = column('temperature_2m');
  final humidity = column('relative_humidity_2m');
  final rainChance = column('precipitation_probability');
  final precipitation = column('precipitation');
  final wind = column('wind_speed_10m');
  final gusts = column('wind_gusts_10m');
  final uv = column('uv_index');
  final code = column('weather_code');

  final hoursByDay = <CalendarDay, List<HourWeather>>{};
  for (var i = 0; i < times.length; i++) {
    final time = _wallTime(times[i], 'hourly.time[$i]');
    final temp = _plausible(temperature[i], -60, 60);
    final rh = _plausible(humidity[i], 0, 100);
    if (temp == null || rh == null) continue;
    final weatherCode = _plausible(code[i], 0, 99);
    (hoursByDay[CalendarDay.of(time)] ??= []).add(
      HourWeather(
        time: time,
        temperatureC: temp,
        humidityPercent: rh,
        rainChancePercent: _plausible(rainChance[i], 0, 100),
        precipitationMm: _plausible(precipitation[i], 0, 500),
        windKmh: _plausible(wind[i], 0, 400),
        gustKmh: _plausible(gusts[i], 0, 500),
        uvIndex: _plausible(uv[i], 0, 25),
        weatherCode: weatherCode == weatherCode?.roundToDouble()
            ? weatherCode?.toInt()
            : null,
      ),
    );
  }

  final sunrise = <CalendarDay, DateTime>{};
  final sunset = <CalendarDay, DateTime>{};
  final daily = json['daily'];
  if (daily is Map<String, Object?>) {
    final days = daily['time'];
    final rises = daily['sunrise'];
    final sets = daily['sunset'];
    if (days is List<Object?> &&
        rises is List<Object?> &&
        sets is List<Object?> &&
        rises.length == days.length &&
        sets.length == days.length) {
      for (var i = 0; i < days.length; i++) {
        final dayText = days[i];
        if (dayText is! String) continue;
        final CalendarDay day;
        try {
          day = CalendarDay.parse(dayText);
        } on FormatException {
          continue; // daylight is optional: skip, do not fail
        }
        final rise = rises[i];
        final set = sets[i];
        if (rise is String) sunrise[day] = _wallTime(rise, 'daily.sunrise');
        if (set is String) sunset[day] = _wallTime(set, 'daily.sunset');
      }
    }
  }

  final days = hoursByDay.keys.toList()..sort();
  return Forecast(
    latitude: latitude,
    longitude: longitude,
    timezone: timezone is String && timezone.length <= 64 ? timezone : null,
    fetchedAt: fetchedAt,
    days: [
      for (final day in days)
        DayWeather(
          day: day,
          hours: hoursByDay[day]!..sort((a, b) => a.time.compareTo(b.time)),
          sunrise: sunrise[day],
          sunset: sunset[day],
        ),
    ],
  );
}

/// Reads a town-search answer. No match is an empty list (Open-Meteo leaves
/// the "results" field out). Entries without a usable name and position are
/// skipped; coordinates are rounded before they go anywhere else.
List<Place> parsePlaces(Map<String, Object?> json) {
  final results = json['results'];
  if (results == null) return const [];
  if (results is! List<Object?>) {
    throw const FormatException('results is not a list');
  }
  final places = <Place>[];
  for (final entry in results.take(20)) {
    if (entry is! Map<String, Object?>) continue;
    final name = _text(entry['name']);
    final lat = _plausible(entry['latitude'], -90, 90);
    final lon = _plausible(entry['longitude'], -180, 180);
    if (name == null || lat == null || lon == null) continue;
    final code = _text(entry['country_code']);
    places.add(
      Place(
        name: name,
        latitude: roundCoordinate(lat),
        longitude: roundCoordinate(lon),
        region: _text(entry['admin1']),
        countryCode: code != null && code.length == 2 ? code : null,
        timezone: _text(entry['timezone']),
      ),
    );
  }
  return places;
}

/// The data must be credited to Open-Meteo (CC BY 4.0). Shown wherever its
/// forecast is shown.
const openMeteoCredit = 'Weather data by Open-Meteo.com';

/// Fetches forecasts and town searches. Network and service errors come out
/// as [FetchFailure]s from [JsonHttp]; a malformed answer as a
/// [FormatException].
final class OpenMeteoClient {
  const new(this._http, {required this.clock});

  final JsonHttp _http;
  final DateTime Function() clock;

  Future<Forecast> forecast(Place place) async {
    final json = await _http.getJson(
      forecastUri(latitude: place.latitude, longitude: place.longitude),
    );
    return parseForecast(json, fetchedAt: clock());
  }

  Future<List<Place>> searchPlaces(String query) async {
    if (cleanPlaceQuery(query).length < minPlaceQueryLength) return const [];
    return parsePlaces(await _http.getJson(geocodingUri(query)));
  }
}

double _number(Object? value, String field, double min, double max) {
  final number = _plausible(value, min, max);
  if (number == null) throw FormatException('$field missing or out of range');
  return number;
}

Map<String, Object?> _object(Object? value, String field) {
  if (value is! Map<String, Object?>) {
    throw FormatException('$field is not an object');
  }
  return value;
}

List<String> _strings(Object? value, String field) {
  if (value is! List<Object?> || value.any((item) => item is! String)) {
    throw FormatException('$field is not a list of strings');
  }
  return value.cast<String>();
}

/// A number within [min]..[max], or null for anything else (missing, null,
/// text, NaN, out of range).
double? _plausible(Object? value, double min, double max) {
  if (value is! num) return null;
  final number = value.toDouble();
  if (number.isNaN || number < min || number > max) return null;
  return number;
}

/// Trimmed, non-empty text of a sane length, or null.
String? _text(Object? value) {
  if (value is! String) return null;
  final text = value.trim();
  if (text.isEmpty || text.length > 100) return null;
  return text;
}

/// "2026-11-27T05:00" as a wall-clock DateTime. Anything with a zone or
/// offset is refused: with timezone=auto the service sends local times, and
/// mixing in UTC would shift every hour.
DateTime _wallTime(String text, String field) {
  final match = RegExp(r'^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$')
      .firstMatch(text);
  if (match == null) throw FormatException('$field: unreadable time', text);
  int part(int group) => int.parse(match.group(group)!);
  final time = DateTime(part(1), part(2), part(3), part(4), part(5));
  if (time.month != part(2) || time.day != part(3) || time.hour != part(4)) {
    throw FormatException('$field: not a real time', text);
  }
  return time;
}
