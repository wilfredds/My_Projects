import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/core/science/explained.dart';
import 'package:ride_doctor/core/science/sources.dart';

void main() {
  test('every formula either cites a source or is plain arithmetic', () {
    const needsNoSource = {
      Formula.measuredMaxHr,
      Formula.wattsPerKg,
      Formula.measuredCircumference,
      Formula.gearCadence,
    };
    for (final formula in Formula.values) {
      final source = sourceFor(formula);
      if (needsNoSource.contains(formula)) {
        expect(source, isNull, reason: formula.name);
      } else {
        expect(source, isNotNull, reason: formula.name);
        expect(source!.citation, isNotEmpty, reason: formula.name);
      }
    }
  });

  test('nothing unopened is labelled verified', () {
    // Guards the honesty rule: these could not be opened when last checked
    // (docs/SCIENCE.md). Upgrade them only after someone reads the source.
    expect(sourceFor(Formula.frielLthrZones)!.status, SourceStatus.unverified);
    expect(
      sourceFor(Formula.cogganPowerZones)!.status,
      SourceStatus.unverified,
    );
  });
}
