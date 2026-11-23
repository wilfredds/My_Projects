import 'dart:math' as math;

import 'package:meta/meta.dart';

/// One chainring/cog combination (SCIENCE.md 7.7).
@immutable
final class Gear {
  const new({required this.chainring, required this.cog})
    : assert(chainring > 0 && cog > 0, 'tooth counts must be positive');

  final int chainring;
  final int cog;

  /// Wheel turns per crank turn. Lower is easier.
  double get ratio => chainring / cog;

  /// Metres travelled per crank turn ("development").
  double developmentM(double circumferenceMm) => ratio * circumferenceMm / 1000;

  /// Pedalling rate needed to hold [speedKmh] in this gear.
  double cadenceRpm({
    required double speedKmh,
    required double circumferenceMm,
  }) => speedKmh * 1000 / 60 / developmentM(circumferenceMm);

  /// Road speed when pedalling this gear at [cadenceRpm].
  double speedKmh({
    required double cadenceRpm,
    required double circumferenceMm,
  }) => cadenceRpm * developmentM(circumferenceMm) * 60 / 1000;

  @override
  bool operator ==(Object other) =>
      other is Gear && other.chainring == chainring && other.cog == cog;

  @override
  int get hashCode => Object.hash(chainring, cog);

  @override
  String toString() => '${chainring}x$cog';
}

/// Every combination the drivetrain offers, easiest first.
List<Gear> allGears({required List<int> chainrings, required List<int> cogs}) {
  final gears = [
    for (final chainring in chainrings)
      for (final cog in cogs) Gear(chainring: chainring, cog: cog),
  ]..sort((a, b) => a.ratio.compareTo(b.ratio));
  return gears;
}

/// A plausible set of cogs for a cassette known only by its range and speed
/// count, e.g. "11-34, 10-speed".
///
/// Most riders know the range printed on the box but not every cog. Real
/// cassettes step by a roughly constant *percentage*, so we space the cogs
/// geometrically. The smallest and largest cogs are exact - and the largest is
/// the one that matters on a climb - but the middle cogs are a guess, so
/// anything computed from them is Rough until the rider confirms the list.
List<int> estimateCogs({
  required int smallest,
  required int largest,
  required int speeds,
}) {
  if (smallest <= 0 || largest <= smallest) {
    throw ArgumentError('need 0 < smallest < largest');
  }
  if (speeds < 2 || speeds > largest - smallest + 1) {
    throw ArgumentError.value(speeds, 'speeds', 'does not fit that range');
  }
  final step = math.pow(largest / smallest, 1 / (speeds - 1));
  final cogs = <int>[];
  for (var i = 0; i < speeds; i++) {
    var teeth = (smallest * math.pow(step, i)).round();
    // Rounding can repeat a size at the small end (11, 12, 12...). Each cog
    // must be at least one tooth bigger than the last.
    if (cogs.isNotEmpty && teeth <= cogs.last) teeth = cogs.last + 1;
    cogs.add(teeth);
  }
  // Keep the top end exact: walk back from the largest cog fixing any that
  // the bump above pushed past it.
  cogs[speeds - 1] = largest;
  for (var i = speeds - 2; i >= 0 && cogs[i] >= cogs[i + 1]; i--) {
    cogs[i] = cogs[i + 1] - 1;
  }
  return cogs;
}
