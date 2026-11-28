import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ride_doctor/core/network/json_http.dart';
import 'package:ride_doctor/features/weather/data/open_meteo.dart';
import 'package:ride_doctor/features/weather/data/weather_service.dart';
import 'package:ride_doctor/features/weather/domain/forecast.dart';
import 'package:ride_doctor/features/weather/domain/place.dart';
import 'package:ride_doctor/features/weather/domain/weather_status.dart';

const imus = Place(name: 'Imus', latitude: 14.4, longitude: 120.9);
const baguio = Place(name: 'Baguio', latitude: 16.4, longitude: 120.6);

/// A small, valid answer: two hours on 28 November.
Map<String, Object?> answer({double noonTemperature = 33}) => {
  'latitude': 14.4,
  'longitude': 120.9,
  'timezone': 'Asia/Manila',
  'hourly': {
    'time': ['2026-11-28T06:00', '2026-11-28T12:00'],
    'temperature_2m': [26.0, noonTemperature],
    'relative_humidity_2m': [88, 62],
  },
};

final class MemoryStore implements ForecastStore {
  SavedForecast? saved;
  int writes = 0;

  @override
  Future<SavedForecast?> read() async => saved;

  @override
  Future<void> write(SavedForecast saved) async {
    this.saved = saved;
    writes++;
  }

  @override
  Future<void> clear() async => saved = null;
}

/// The service with a controllable clock and a scripted network.
final class Harness {
  new() {
    service = WeatherService(
      client: OpenMeteoClient(
        JsonHttp(
          MockClient((request) async {
            requests++;
            return await respond(request);
          }),
          maxAttempts: 1,
          sleep: (_) async {},
        ),
        clock: () => now,
      ),
      store: store,
      clock: () => now,
    );
  }

  DateTime now = DateTime(2026, 11, 28, 5);
  int requests = 0;
  final store = MemoryStore();
  late final WeatherService service;
  FutureOr<http.Response> Function(http.Request) respond = (_) =>
      http.Response(jsonEncode(answer()), 200);

  void offline() => respond = (_) => throw http.ClientException('no signal');

  void save({required Duration age, Place place = imus, String? json}) =>
      store.saved = SavedForecast(
        place: place,
        fetchedAt: now.subtract(age),
        json: json ?? jsonEncode(answer(noonTemperature: 30)),
      );

  void wait(Duration duration) => now = now.add(duration);
}

void main() {
  test('nothing saved: fetches, saves and returns a fresh forecast', () async {
    final h = Harness();
    final status = await h.service.forecastFor(imus);
    expect(status, isA<WeatherReady>());
    final ready = status as WeatherReady;
    expect(ready.freshness, ForecastFreshness.fresh);
    expect(ready.problem, isNull);
    expect(ready.forecast.days.single.hours, hasLength(2));
    expect(h.requests, 1);
    expect(h.store.saved!.place, imus);
    expect(h.store.saved!.fetchedAt, h.now);
    expect(jsonDecode(h.store.saved!.json), answer());
  });

  test('a saved forecast under an hour old is used without asking', () async {
    final h = Harness()..save(age: const Duration(minutes: 59));
    final status = await h.service.forecastFor(imus) as WeatherReady;
    expect(h.requests, 0);
    expect(status.freshness, ForecastFreshness.fresh);
    // It is the saved one (30 C at noon), not a new one (33 C).
    expect(status.forecast.days.single.hours.last.temperatureC, 30);
  });

  test('an older saved forecast is refreshed', () async {
    final h = Harness()..save(age: const Duration(hours: 2));
    final status = await h.service.forecastFor(imus) as WeatherReady;
    expect(h.requests, 1);
    expect(status.freshness, ForecastFreshness.fresh);
    expect(status.forecast.days.single.hours.last.temperatureC, 33);
  });

  test('offline: a saved forecast under 12 hours is used, marked', () async {
    final h = Harness()
      ..save(age: const Duration(hours: 11, minutes: 59))
      ..offline();
    final status = await h.service.forecastFor(imus) as WeatherReady;
    expect(status.freshness, ForecastFreshness.stale);
    expect(status.problem, WeatherProblem.offline);
  });

  test('offline: an older saved forecast is not used', () async {
    final h = Harness()
      ..save(age: const Duration(hours: 12))
      ..offline();
    final status = await h.service.forecastFor(imus);
    expect(status, isA<WeatherUnavailable>());
    expect((status as WeatherUnavailable).problem, WeatherProblem.offline);
  });

  test('requests are at least 10 minutes apart, even when forced', () async {
    final h = Harness()..offline();
    await h.service.forecastFor(imus);
    expect(h.requests, 1);

    h.wait(const Duration(minutes: 9));
    final status = await h.service.forecastFor(imus, force: true);
    expect(h.requests, 1);
    expect((status as WeatherUnavailable).problem, WeatherProblem.offline);

    h.wait(const Duration(minutes: 1));
    await h.service.forecastFor(imus, force: true);
    expect(h.requests, 2);
  });

  test('the pause after "too many requests" covers every town', () async {
    final h = Harness()
      ..respond = (_) => http.Response('{"error":true,"reason":"limit"}', 429);
    await h.service.forecastFor(imus);
    expect(await h.service.forecastFor(baguio), isA<WeatherUnavailable>());
    expect(h.requests, 1);
  });

  test('after "too many requests", nothing is asked for an hour', () async {
    final h = Harness()
      ..respond = (_) => http.Response('{"error":true,"reason":"limit"}', 429);
    final first = await h.service.forecastFor(imus);
    expect((first as WeatherUnavailable).problem, WeatherProblem.busy);

    h.respond = (_) => http.Response(jsonEncode(answer()), 200);
    // Not a cascade: in one, `..wait` would bind to the Response.
    // ignore: cascade_invocations
    h.wait(const Duration(minutes: 59));
    final later = await h.service.forecastFor(imus, force: true);
    expect(h.requests, 1);
    expect((later as WeatherUnavailable).problem, WeatherProblem.busy);

    h.wait(const Duration(minutes: 1));
    final after = await h.service.forecastFor(imus);
    expect(h.requests, 2);
    expect(after, isA<WeatherReady>());
  });

  test('two callers at once share one request', () async {
    final h = Harness();
    final answers = Completer<http.Response>();
    h.respond = (_) => answers.future;
    final a = h.service.forecastFor(imus);
    final b = h.service.forecastFor(imus);
    answers.complete(http.Response(jsonEncode(answer()), 200));
    final results = await Future.wait([a, b]);
    expect(h.requests, 1);
    expect(results, everyElement(isA<WeatherReady>()));
  });

  test('a changed town waits for the request under way, then asks', () async {
    final h = Harness();
    final first = Completer<http.Response>();
    final towns = <String?>[];
    h.respond = (request) {
      towns.add(request.url.queryParameters['latitude']);
      return towns.length == 1
          ? first.future
          : http.Response(jsonEncode(answer()), 200);
    };
    final a = h.service.forecastFor(imus);
    final b = h.service.forecastFor(baguio);
    first.complete(http.Response(jsonEncode(answer()), 200));
    await Future.wait([a, b]);
    // Sent one after the other, never together; the 10-minute gap is per
    // town, so the new town gets its forecast at once.
    expect(towns, ['14.4', '16.4']);
    expect(await b, isA<WeatherReady>());
  });

  test('a forecast saved for another town is ignored', () async {
    final h = Harness()..save(age: Duration.zero, place: baguio);
    await h.service.forecastFor(imus);
    expect(h.requests, 1);
    expect(h.store.saved!.place, imus);
  });

  test('a saved answer that no longer reads counts as nothing saved', () async {
    final h = Harness()
      ..save(age: Duration.zero, json: '{"hourly": 3}')
      ..offline();
    expect(await h.service.forecastFor(imus), isA<WeatherUnavailable>());

    final g = Harness()
      ..save(age: Duration.zero, json: 'not json')
      ..offline();
    expect(await g.service.forecastFor(imus), isA<WeatherUnavailable>());

    final k = Harness()
      ..save(age: Duration.zero, json: '[1, 2]')
      ..offline();
    expect(await k.service.forecastFor(imus), isA<WeatherUnavailable>());
  });

  test('an unreadable new answer keeps the saved one, marked', () async {
    final h = Harness()
      ..save(age: const Duration(hours: 3))
      ..respond = (_) => http.Response('{"latitude": 14.4}', 200);
    final status = await h.service.forecastFor(imus) as WeatherReady;
    expect(status.problem, WeatherProblem.unreadable);
    expect(status.freshness, ForecastFreshness.stale);
    expect(h.store.writes, 0);
  });

  test('service errors and bad answers have their own problem', () async {
    final h = Harness()..respond = (_) => http.Response('{}', 503);
    expect(
      (await h.service.forecastFor(imus) as WeatherUnavailable).problem,
      WeatherProblem.serviceError,
    );
    final g = Harness()..respond = (_) => http.Response('[]', 200);
    expect(
      (await g.service.forecastFor(imus) as WeatherUnavailable).problem,
      WeatherProblem.unreadable,
    );
  });

  test('forcing refreshes even a fresh forecast', () async {
    final h = Harness()..save(age: const Duration(minutes: 5));
    await h.service.forecastFor(imus, force: true);
    expect(h.requests, 1);
  });

  test('savedFor never asks the network', () async {
    final h = Harness();
    expect(await h.service.savedFor(imus), isNull);
    h.save(age: const Duration(hours: 2));
    final saved = (await h.service.savedFor(imus))! as WeatherReady;
    expect(saved.freshness, ForecastFreshness.stale);
    h.save(age: const Duration(hours: 13));
    expect(await h.service.savedFor(imus), isNull);
    expect(h.requests, 0);
  });
}
