import 'dart:async';
import 'dart:convert';

import 'package:ride_doctor/core/network/json_http.dart';
import 'package:ride_doctor/features/weather/data/open_meteo.dart';
import 'package:ride_doctor/features/weather/domain/forecast.dart';
import 'package:ride_doctor/features/weather/domain/place.dart';
import 'package:ride_doctor/features/weather/domain/weather_status.dart';

/// When to fetch a forecast and what to fall back on (docs/SCIENCE.md,
/// "Weather"; ADR-0026).
///
/// - A saved forecast under an hour old is used as it is: no request.
/// - Otherwise one request is made - only one at a time; a second caller
///   waits for the same answer.
/// - Requests for one town are at least [minGap] apart, even when the rider
///   pulls to refresh, and after "too many requests" none is made for
///   [busyPause]:
///   the free service counts every call, and a phone network may share
///   its allowance between many people.
/// - If fetching fails, a saved forecast under 12 hours old is used and
///   marked as not up to date; an older one is not used at all.
final class WeatherService {
  new({required this._client, required this._store, required this._clock});

  final OpenMeteoClient _client;
  final ForecastStore _store;
  final DateTime Function() _clock;

  /// Our own limits, kept low on purpose (ADR-0026).
  static const minGap = Duration(minutes: 10);
  static const busyPause = Duration(hours: 1);

  /// The gap applies per town, so a rider who has just changed town gets
  /// its forecast; the pause after "too many requests" applies to all.
  DateTime? _lastAttempt;
  Place? _lastAttemptPlace;
  DateTime? _pausedUntil;
  WeatherProblem? _lastProblem;
  Future<WeatherStatus>? _inFlight;
  Place? _inFlightPlace;

  /// The forecast for [place]: saved if fresh enough, fetched if not.
  /// [force] skips the "fresh enough" check but not the limits above.
  Future<WeatherStatus> forecastFor(Place place, {bool force = false}) async {
    // One at a time: join a request already under way for the same town;
    // wait for one for another town (the rider has just changed it).
    while (_inFlight != null) {
      if (_inFlightPlace == place) return await _inFlight!;
      try {
        await _inFlight;
      } on Object {
        // That caller handles its own failure.
      }
    }
    _inFlightPlace = place;
    final future = _forecastFor(place, force: force);
    _inFlight = future;
    try {
      return await future;
    } finally {
      _inFlight = null;
      _inFlightPlace = null;
    }
  }

  /// The saved forecast for [place], without any request.
  Future<WeatherStatus?> savedFor(Place place) async {
    final saved = await _readSaved(place);
    return saved == null ? null : _readyFrom(saved, _lastProblem);
  }

  Future<WeatherStatus> _forecastFor(Place place, {required bool force}) async {
    final now = _clock();
    final saved = await _readSaved(place);
    final savedFreshness = saved == null
        ? ForecastFreshness.expired
        : freshnessOf(fetchedAt: saved.fetchedAt, now: now);
    if (!force && savedFreshness == ForecastFreshness.fresh) {
      return _readyFrom(saved!, null)!;
    }

    final pausedUntil = _pausedUntil;
    final lastAttempt = _lastAttemptPlace == place ? _lastAttempt : null;
    final mayAsk =
        (pausedUntil == null || !now.isBefore(pausedUntil)) &&
        (lastAttempt == null ||
            now.difference(lastAttempt) >= minGap ||
            now.isBefore(lastAttempt)); // the clock went back: allow
    if (!mayAsk) return _fallback(saved, _lastProblem ?? WeatherProblem.busy);

    _lastAttempt = now;
    _lastAttemptPlace = place;
    try {
      final json = await _client.forecastJson(place);
      final fetchedAt = _clock();
      final forecast = parseForecast(json, fetchedAt: fetchedAt);
      await _store.write(
        SavedForecast(
          place: place,
          fetchedAt: fetchedAt,
          json: jsonEncode(json),
        ),
      );
      _lastProblem = null;
      return WeatherReady(
        forecast: forecast,
        freshness: ForecastFreshness.fresh,
      );
    } on FetchFailure catch (failure) {
      final problem = switch (failure) {
        NoConnection() => WeatherProblem.offline,
        RateLimited() => WeatherProblem.busy,
        ServerError() => WeatherProblem.serviceError,
        BadResponse() => WeatherProblem.unreadable,
      };
      if (problem == WeatherProblem.busy) _pausedUntil = now.add(busyPause);
      _lastProblem = problem;
      return _fallback(saved, problem);
    } on FormatException {
      _lastProblem = WeatherProblem.unreadable;
      return _fallback(saved, WeatherProblem.unreadable);
    }
  }

  WeatherStatus _fallback(_Saved? saved, WeatherProblem problem) {
    if (saved == null) return WeatherUnavailable(problem);
    return _readyFrom(saved, problem) ?? WeatherUnavailable(problem);
  }

  WeatherReady? _readyFrom(_Saved saved, WeatherProblem? problem) {
    final freshness = freshnessOf(fetchedAt: saved.fetchedAt, now: _clock());
    if (freshness == ForecastFreshness.expired) return null;
    return WeatherReady(
      forecast: saved.forecast,
      freshness: freshness,
      problem: problem,
    );
  }

  /// The saved forecast if it is for [place] and still reads correctly.
  /// Anything else - another town, or an answer an updated app can no longer
  /// read - counts as nothing saved.
  Future<_Saved?> _readSaved(Place place) async {
    final saved = await _store.read();
    if (saved == null ||
        saved.place.latitude != place.latitude ||
        saved.place.longitude != place.longitude) {
      return null;
    }
    try {
      final json = jsonDecode(saved.json);
      if (json is! Map<String, Object?>) return null;
      return _Saved(
        saved.fetchedAt,
        parseForecast(json, fetchedAt: saved.fetchedAt),
      );
    } on FormatException {
      return null;
    }
  }
}

final class _Saved {
  const new(this.fetchedAt, this.forecast);

  final DateTime fetchedAt;
  final Forecast forecast;
}
