import 'package:freezed_annotation/freezed_annotation.dart';

part 'race_debrief.freezed.dart';

/// Where the race was hardest. More than one may apply.
enum StruggleArea {
  climbs,
  corners,
  positioning,
  accelerations,
  sprint,
  pacing,
  fuelling,
  heat,
  mechanical,
  nerves,
}

/// When the rider lost contact with the group, if they did.
enum DroppedWhen { notDropped, earlyOn, midRace, nearTheEnd }

/// Anything physical the rider noticed. These feed the diagnosis engine in
/// Phase 4; here they are only recorded.
enum RaceSymptom { cramps, breathless, pain, numbness, dizziness }

/// What the rider reports after a race. Structured rather than free text so
/// later phases can act on it: a debrief saying "dropped on climbs, cramps"
/// becomes input to both the diagnosis and the next plan.
@freezed
abstract class RaceDebrief with _$RaceDebrief {
  const factory({
    required String raceId,
    required bool finished,
    required DroppedWhen droppedWhen,
    required DateTime recordedAt,
    @Default(<StruggleArea>{}) Set<StruggleArea> struggles,
    @Default(<RaceSymptom>{}) Set<RaceSymptom> symptoms,
    int? placing,
    int? fieldSize,
    String? wouldChange,
  }) = _RaceDebrief;

  const new _();

  /// These symptoms are red flags (PROMPT.md 3.3): they always lead to "see
  /// a doctor", never to training or bike-fit advice.
  bool get hasRedFlag => symptoms.contains(RaceSymptom.dizziness);
}
