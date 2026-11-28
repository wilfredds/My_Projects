import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ride_doctor/core/network/json_http.dart';
import 'package:ride_doctor/core/time/calendar_day.dart';
import 'package:ride_doctor/features/weather/data/open_meteo.dart';
import 'package:ride_doctor/features/weather/domain/place.dart';

final fetchedAt = DateTime(2026, 11, 27, 4, 30);

/// A saved Open-Meteo answer (test/fixtures/open_meteo/README.md).
Map<String, Object?> fixture(String name) =>
    jsonDecode(File('test/fixtures/open_meteo/$name').readAsStringSync())
        as Map<String, Object?>;

/// A forecast answer in Open-Meteo's documented shape, built by hand for
/// these tests: two days, a few hours each.
Map<String, Object?> forecastJson({
  Map<String, Object?> hourlyOverrides = const {},
  Object? daily = _defaultDaily,
}) => {
  'latitude': 14.3,
  'longitude': 120.9,
  'generationtime_ms': 0.3,
  'utc_offset_seconds': 28800,
  'timezone': 'Asia/Manila',
  'timezone_abbreviation': 'GMT+8',
  'elevation': 70.0,
  'hourly_units': {'time': 'iso8601', 'temperature_2m': '°C'},
  'hourly': {
    'time': [
      '2026-11-27T05:00',
      '2026-11-27T06:00',
      '2026-11-27T12:00',
      '2026-11-28T06:00',
    ],
    'temperature_2m': [25.0, 26.0, 34.0, 26.5],
    'relative_humidity_2m': [90, 88, 60, 87],
    'precipitation_probability': [10, 10, 40, null],
    'precipitation': [0.0, 0.0, 0.2, 0.0],
    'wind_speed_10m': [5.2, 6.1, 12.0, 4.0],
    'wind_gusts_10m': [10.0, 12.0, 30.0, 8.0],
    'uv_index': [0.0, 0.5, 11.2, 0.4],
    'weather_code': [1, 2, 95, 3],
    ...hourlyOverrides,
  },
  'daily': ?daily,
};

const _defaultDaily = {
  'time': ['2026-11-27', '2026-11-28'],
  'sunrise': ['2026-11-27T06:05', '2026-11-28T06:06'],
  'sunset': ['2026-11-27T17:25', '2026-11-28T17:25'],
};

void main() {
  group('forecastUri', () {
    test('asks for what the app uses, at rounded coordinates, over HTTPS', () {
      final uri = forecastUri(latitude: 14.32944, longitude: 120.93667);
      expect(uri.scheme, 'https');
      expect(uri.host, 'api.open-meteo.com');
      expect(uri.path, '/v1/forecast');
      expect(uri.queryParameters['latitude'], '14.3');
      expect(uri.queryParameters['longitude'], '120.9');
      expect(uri.queryParameters['timezone'], 'auto');
      expect(uri.queryParameters['forecast_days'], '7');
      expect(uri.queryParameters['daily'], 'sunrise,sunset');
      expect(
        uri.queryParameters['hourly']!.split(','),
        containsAll(['temperature_2m', 'relative_humidity_2m', 'weather_code']),
      );
    });
  });

  group('geocodingUri', () {
    test('sends only the cleaned-up name', () {
      final uri = geocodingUri('  Dasmariñas\n');
      expect(uri.scheme, 'https');
      expect(uri.host, 'geocoding-api.open-meteo.com');
      expect(uri.queryParameters['name'], 'Dasmariñas');
      expect(uri.queryParameters['count'], '10');
    });

    test('control characters are stripped and long input is cut', () {
      expect(cleanPlaceQuery('Ca\u0000vite\u0007'), 'Cavite');
      expect(cleanPlaceQuery('x' * 100), hasLength(60));
    });

    test('only the text before a comma is sent', () {
      // Text after a comma must match a province exactly, or nothing is
      // found at all.
      expect(cleanPlaceQuery('Imus, Cavite Province'), 'Imus');
      expect(
        geocodingUri(' Tagaytay , PH').queryParameters['name'],
        'Tagaytay',
      );
      expect(cleanPlaceQuery(', Cavite'), isEmpty);
    });
  });

  group('parseForecast', () {
    test('reads hours into days, with daylight', () {
      final forecast = parseForecast(forecastJson(), fetchedAt: fetchedAt);
      expect(forecast.latitude, 14.3);
      expect(forecast.timezone, 'Asia/Manila');
      expect(forecast.fetchedAt, fetchedAt);
      expect(forecast.days.map((d) => d.day), [
        CalendarDay(2026, 11, 27),
        CalendarDay(2026, 11, 28),
      ]);
      final today = forecast.days.first;
      expect(today.hours, hasLength(3));
      expect(today.hours.first.time, DateTime(2026, 11, 27, 5));
      expect(today.sunrise, DateTime(2026, 11, 27, 6, 5));
      expect(today.sunset, DateTime(2026, 11, 27, 17, 25));
      final noon = today.hours[2];
      expect(noon.temperatureC, 34);
      expect(noon.humidityPercent, 60);
      expect(noon.rainChancePercent, 40);
      expect(noon.uvIndex, 11.2);
      expect(noon.weatherCode, 95);
      expect(noon.thunderstorm, isTrue);
    });

    test('null stays unknown, never zero', () {
      final tomorrow = parseForecast(
        forecastJson(),
        fetchedAt: fetchedAt,
      ).days[1];
      expect(tomorrow.hours.single.rainChancePercent, isNull);
    });

    test('implausible single values become unknown', () {
      final forecast = parseForecast(
        forecastJson(
          hourlyOverrides: {
            'precipitation_probability': [140, -5, 40, 10],
            'wind_speed_10m': [-1, 6.1, 12.0, 4.0],
            'weather_code': [1.5, 2, 95, 300],
          },
        ),
        fetchedAt: fetchedAt,
      );
      final first = forecast.days.first.hours.first;
      expect(first.rainChancePercent, isNull);
      expect(first.windKmh, isNull);
      expect(first.weatherCode, isNull);
      expect(forecast.days[1].hours.single.weatherCode, isNull);
    });

    test('an hour without usable temperature or humidity is left out', () {
      final forecast = parseForecast(
        forecastJson(
          hourlyOverrides: {
            'temperature_2m': [25.0, null, 34.0, 99.0],
            'relative_humidity_2m': [90, 88, 'high', 87],
          },
        ),
        fetchedAt: fetchedAt,
      );
      // 06:00 has no temperature, 12:00 no number for humidity, and
      // tomorrow's 99 C is impossible: only 05:00 remains.
      expect(forecast.days, hasLength(1));
      expect(forecast.days.single.hours.single.time, DateTime(2026, 11, 27, 5));
    });

    test('a missing optional variable is unknown for every hour', () {
      final json = forecastJson();
      (json['hourly']! as Map<String, Object?>).remove('uv_index');
      final forecast = parseForecast(json, fetchedAt: fetchedAt);
      expect(forecast.days.first.hours.every((h) => h.uvIndex == null), isTrue);
    });

    test('daylight is optional', () {
      final forecast = parseForecast(
        forecastJson(daily: null),
        fetchedAt: fetchedAt,
      );
      expect(forecast.days.first.sunrise, isNull);
      final odd = parseForecast(
        forecastJson(
          daily: {
            'time': ['nonsense'],
            'sunrise': [null],
            'sunset': [null],
          },
        ),
        fetchedAt: fetchedAt,
      );
      expect(odd.days.first.sunset, isNull);
    });

    test('structural problems reject the whole answer', () {
      Map<String, Object?> broken(void Function(Map<String, Object?>) edit) {
        final json = forecastJson();
        edit(json);
        return json;
      }

      for (final json in [
        broken((j) => j.remove('hourly')),
        broken((j) => j['latitude'] = 'north'),
        broken((j) => j['latitude'] = 120),
        broken((j) => (j['hourly']! as Map<String, Object?>)['time'] = 'now'),
        broken(
          (j) =>
              (j['hourly']! as Map<String, Object?>)['temperature_2m'] = [25.0],
        ),
        broken(
          (j) => (j['hourly']! as Map<String, Object?>)['time'] = [
            '2026-11-27T05:00Z',
            '2026-11-27T06:00',
            '2026-11-27T12:00',
            '2026-11-28T06:00',
          ],
        ),
        broken(
          (j) => (j['hourly']! as Map<String, Object?>)['time'] = [
            '2026-02-30T05:00',
            '2026-11-27T06:00',
            '2026-11-27T12:00',
            '2026-11-28T06:00',
          ],
        ),
      ]) {
        expect(
          () => parseForecast(json, fetchedAt: fetchedAt),
          throwsFormatException,
        );
      }
    });

    test('refuses an absurd number of hours', () {
      final times = List.generate(400, (i) => '2026-11-27T05:00');
      expect(
        () => parseForecast(
          forecastJson(hourlyOverrides: {'time': times}),
          fetchedAt: fetchedAt,
        ),
        throwsFormatException,
      );
    });
  });

  group('parsePlaces', () {
    test('reads matches and rounds their coordinates', () {
      final places = parsePlaces({
        'results': [
          {
            'id': 1,
            'name': 'Dasmariñas',
            'latitude': 14.32944,
            'longitude': 120.93667,
            'country_code': 'PH',
            'admin1': 'Calabarzon',
            'timezone': 'Asia/Manila',
          },
          {'name': 'No position'},
          {'name': '', 'latitude': 1, 'longitude': 1},
          'not an object',
        ],
        'generationtime_ms': 0.4,
      });
      expect(places, const [
        Place(
          name: 'Dasmariñas',
          latitude: 14.3,
          longitude: 120.9,
          region: 'Calabarzon',
          countryCode: 'PH',
          timezone: 'Asia/Manila',
        ),
      ]);
      expect(places.single.label, 'Dasmariñas, Calabarzon, PH');
    });

    test('no match is an empty list', () {
      expect(parsePlaces({'generationtime_ms': 0.2}), isEmpty);
    });

    test('a results field that is not a list is malformed', () {
      expect(() => parsePlaces({'results': 'x'}), throwsFormatException);
    });
  });

  group('OpenMeteoClient', () {
    OpenMeteoClient client(http.Response Function(http.Request) answer) =>
        OpenMeteoClient(
          JsonHttp(
            MockClient((request) async => answer(request)),
            maxAttempts: 1,
          ),
          clock: () => fetchedAt,
        );

    test('fetches and reads a forecast for a place', () async {
      Uri? asked;
      final forecast =
          await client((request) {
            asked = request.url;
            return http.Response.bytes(
              utf8.encode(jsonEncode(forecastJson())),
              200,
            );
          }).forecast(
            const Place(name: 'Dasmariñas', latitude: 14.3, longitude: 120.9),
          );
      expect(asked!.queryParameters['latitude'], '14.3');
      expect(forecast.days, hasLength(2));
      expect(forecast.fetchedAt, fetchedAt);
    });

    test('searches places, but not for one letter', () async {
      var calls = 0;
      final c = client((request) {
        calls++;
        return http.Response(jsonEncode({'results': <Object?>[]}), 200);
      });
      expect(await c.searchPlaces(' D '), isEmpty);
      expect(calls, 0);
      expect(await c.searchPlaces('Dasma'), isEmpty);
      expect(calls, 1);
    });

    test('a rate limit comes through as such', () async {
      await expectLater(
        client(
          (request) => http.Response(
            '{"reason":"Daily API request limit exceeded. '
            'Please try again tomorrow.","error":true}',
            429,
          ),
        ).forecast(const Place(name: 'X', latitude: 1, longitude: 1)),
        throwsA(isA<RateLimited>()),
      );
    });
  });

  group('saved real answers', () {
    test('a forecast with many more variables than ours', () {
      final forecast = parseForecast(
        fixture('forecast_many_variables.json'),
        fetchedAt: fetchedAt,
      );
      expect(forecast.timezone, 'Europe/Amsterdam');
      expect(forecast.days, hasLength(1)); // hours were given for one day
      final day = forecast.days.single;
      expect(day.day, CalendarDay(2026, 10, 3));
      expect(day.sunrise, DateTime(2026, 10, 3, 7, 36));
      expect(day.sunset, DateTime(2026, 10, 3, 19, 5));
      expect(day.hours, hasLength(3));
      final first = day.hours.first;
      expect(first.time, DateTime(2026, 10, 3));
      expect(first.temperatureC, 11.8);
      expect(first.humidityPercent, 87);
      expect(first.rainChancePercent, 0);
      expect(first.precipitationMm, 0);
      expect(first.windKmh, 9.0);
      expect(first.gustKmh, 14.8);
      expect(first.uvIndex, 0);
      expect(first.weatherCode, 0);
      expect(day.hours.map((h) => h.weatherCode), [0, 1, 1]);
    });

    test('a forecast without humidity has no hour it can judge', () {
      // Temperature alone cannot give a heat index, so every hour is left
      // out rather than guessed.
      final forecast = parseForecast(
        fixture('forecast_7day_temperature_only.json'),
        fetchedAt: fetchedAt,
      );
      expect(forecast.days, isEmpty);
      expect(forecast.timezone, 'America/Sao_Paulo');
    });

    test('an answer with no hourly data is rejected', () {
      expect(
        () => parseForecast(
          fixture('forecast_daily_nulls.json'),
          fetchedAt: fetchedAt,
        ),
        throwsFormatException,
      );
    });

    test('town matches, one with fields left out', () {
      final places = parsePlaces(fixture('geocoding_enschede.json'));
      expect(places, hasLength(2));
      expect(
        places.first,
        const Place(
          name: 'Enschede',
          latitude: 52.2,
          longitude: 6.9,
          region: 'Overijssel',
          countryCode: 'NL',
          timezone: 'Europe/Amsterdam',
        ),
      );
      expect(places.last.name, 'Enschede Airport Twente');
    });

    test('two towns with one name are told apart by their label', () {
      final places = parsePlaces(fixture('geocoding_paris.json'));
      expect(places.map((p) => p.label), [
        'Paris, Île-de-France, FR',
        'Paris, Texas, US',
      ]);
    });

    test('no match', () {
      expect(parsePlaces(fixture('geocoding_no_match.json')), isEmpty);
    });
  });

  test('Place equality and description', () {
    const a = Place(name: 'Imus', latitude: 14.4, longitude: 120.9);
    expect(a, const Place(name: 'Imus', latitude: 14.4, longitude: 120.9));
    expect(
      a.hashCode,
      const Place(name: 'Imus', latitude: 14.4, longitude: 120.9).hashCode,
    );
    expect(a.label, 'Imus');
    expect(a.toString(), contains('Imus'));
  });

  test('the credit lines name the services and link over HTTPS', () {
    expect(openMeteoCredit, 'Weather data by Open-Meteo.com');
    expect(Uri.parse(openMeteoUrl).scheme, 'https');
    expect(Uri.parse(openMeteoLicenceUrl).scheme, 'https');
    expect(
      geocodingCredit,
      allOf(contains('Open-Meteo'), contains('GeoNames')),
    );
  });
}
