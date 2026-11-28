import 'package:freezed_annotation/freezed_annotation.dart';

part 'race_event.freezed.dart';

enum RaceType { criterium, roadRace, timeTrial, gravel, mtbXc }

/// A race the rider has entered.
///
/// [startsAt] is the start time as shown on a clock at the race: a "wall
/// time" with no time zone. A race at 6:30 is at 6:30 whatever zone the phone
/// thinks it is in, and the app compares it with the phone's local time.
@freezed
abstract class RaceEvent with _$RaceEvent {
  const factory({
    required String id,
    required String name,
    required RaceType type,
    required DateTime startsAt,
    String? location,
    double? distanceKm,
    int? durationMinutes,
    int? laps,
    double? lapLengthKm,
    int? cornerCount,
    int? elevationGainM,
    String? category,
    String? rulesNotes,

    /// Minutes from home to the venue; shapes the race-day timeline.
    @Default(30) int travelMinutes,

    /// Whether riders may ride the course before the start.
    @Default(true) bool reconAllowed,

    /// When the rider added the race to the app - how much notice they had.
    /// Null for a race not saved yet. It fixes the taper's length
    /// (`taperDaysFor` in countdown.dart), so the plan keeps its shape as
    /// the race nears.
    DateTime? addedAt,
  }) = _RaceEvent;
}
