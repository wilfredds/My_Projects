import 'package:meta/meta.dart';
import 'package:ride_doctor/features/weather/domain/forecast.dart';
import 'package:ride_doctor/features/weather/domain/place.dart';

/// Why the latest forecast could not be fetched, in the terms the rider is
/// told about.
enum WeatherProblem {
  /// No signal, or no answer in time.
  offline,

  /// The service's free daily allowance is used up, possibly by other people
  /// on the same phone network. Tried again later, not straight away.
  busy,

  /// The service answered with an error.
  serviceError,

  /// The answer could not be read.
  unreadable,
}

/// What the app knows about the weather for the rider's town.
@immutable
sealed class WeatherStatus {
  const new();
}

/// A forecast to use. [freshness] is never expired here: an expired forecast
/// is not used at all. [problem] says why it is not newer, if a fetch failed.
final class WeatherReady extends WeatherStatus {
  const new({required this.forecast, required this.freshness, this.problem})
    : assert(
        freshness != ForecastFreshness.expired,
        'an expired forecast is never used',
      );

  final Forecast forecast;
  final ForecastFreshness freshness;
  final WeatherProblem? problem;
}

/// No usable forecast: nothing saved for this town, or what was saved is too
/// old, and fetching failed.
final class WeatherUnavailable extends WeatherStatus {
  const new(this.problem);

  final WeatherProblem problem;
}

/// The last forecast fetched, as kept on the phone. The answer is stored as
/// the service sent it and read again on the way out, so the same checks
/// apply to saved and fresh data.
@immutable
final class SavedForecast {
  const new({required this.place, required this.fetchedAt, required this.json});

  final Place place;
  final DateTime fetchedAt;

  /// The service's JSON answer, as text.
  final String json;
}

/// Where the last forecast is kept (the encrypted database in the app).
abstract interface class ForecastStore {
  Future<SavedForecast?> read();
  Future<void> write(SavedForecast saved);

  /// Called when the rider withdraws location consent or clears the town.
  Future<void> clear();
}
