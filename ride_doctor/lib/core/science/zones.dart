import 'package:meta/meta.dart';

/// One training zone as an inclusive range of whole units (bpm or watts).
@immutable
final class Zone {
  const new({required this.label, required this.lower, this.upper});

  /// Short conventional name: "1".."5", or "5a"/"5b"/"5c" for Friel zones.
  final String label;

  final int lower;

  /// Inclusive. Null means the zone has no top ("and above").
  final int? upper;

  @override
  bool operator ==(Object other) =>
      other is Zone &&
      other.label == label &&
      other.lower == lower &&
      other.upper == upper;

  @override
  int get hashCode => Object.hash(label, lower, upper);

  @override
  String toString() => 'Z$label[$lower..${upper ?? ''}]';
}

/// Rounds [value] x [percent] / 100 to the nearest whole number, halves up,
/// using integer arithmetic only.
int percentOfRounded(int value, int percent) =>
    (value * percent * 2 + 100) ~/ 200;

/// Turns a list of zone starting points into contiguous zones: each zone ends
/// one unit below the next one's start, so no value falls in two zones or in
/// none.
List<Zone> zonesFromLowerBounds(
  List<String> labels,
  List<int> lowers, {
  required int? topUpper,
}) {
  assert(labels.length == lowers.length, 'one label per zone');
  return [
    for (var i = 0; i < lowers.length; i++)
      Zone(
        label: labels[i],
        lower: lowers[i],
        upper: i + 1 < lowers.length ? lowers[i + 1] - 1 : topUpper,
      ),
  ];
}
