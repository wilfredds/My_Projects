import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/features/profile/domain/number_rule.dart';

void main() {
  group('NumberRule.parse', () {
    test('reads plain and decimal numbers', () {
      expect(NumberRule.parse('72'), 72);
      expect(NumberRule.parse(' 72.5 '), 72.5);
    });

    test('accepts a comma as the decimal separator', () {
      expect(NumberRule.parse('72,5'), 72.5);
    });

    test('rejects text, empty input and non-finite values', () {
      expect(NumberRule.parse('abc'), isNull);
      expect(NumberRule.parse(''), isNull);
      expect(NumberRule.parse(null), isNull);
      expect(NumberRule.parse('NaN'), isNull);
      expect(NumberRule.parse('Infinity'), isNull);
    });
  });

  group('NumberRule.check', () {
    const rule = ProfileLimits.weightKg;

    test('accepts the range including both ends', () {
      expect(rule.check(30), isNull);
      expect(rule.check(72.5), isNull);
      expect(rule.check(250), isNull);
    });

    test('rejects values just outside', () {
      expect(rule.check(29.9), NumberProblem.tooLow);
      expect(rule.check(250.1), NumberProblem.tooHigh);
    });

    test('whole-number rules reject fractions', () {
      expect(ProfileLimits.restingHrBpm.check(52.5), NumberProblem.notWhole);
      expect(ProfileLimits.restingHrBpm.check(52), isNull);
    });
  });

  group('NumberRule.checkText', () {
    const rule = ProfileLimits.heightCm;

    test('a required field must not be empty', () {
      expect(rule.checkText(''), NumberProblem.empty);
      expect(rule.checkText('   '), NumberProblem.empty);
      expect(rule.checkText(null), NumberProblem.empty);
    });

    test('an optional field may be empty', () {
      expect(rule.checkText('', required: false), isNull);
    });

    test('an optional field is still validated when filled', () {
      expect(rule.checkText('17', required: false), NumberProblem.tooLow);
    });

    test('reports text that is not a number', () {
      expect(rule.checkText('tall'), NumberProblem.notANumber);
    });

    test('catches the classic unit mix-ups', () {
      expect(rule.checkText('1.65'), NumberProblem.tooLow); // metres
      expect(ProfileLimits.weightKg.checkText('700'), NumberProblem.tooHigh);
    });
  });

  test('birth year limits follow the current year', () {
    final rule = ProfileLimits.birthYear(currentYear: 2026);
    expect(rule.check(2013), isNull); // 13 this year
    expect(rule.check(2014), NumberProblem.tooHigh); // too young
    expect(rule.check(1926), isNull); // 100
    expect(rule.check(1925), NumberProblem.tooLow);
    expect(rule.check(2004.5), NumberProblem.notWhole);
  });

  group('parseTeeth', () {
    const ring = ProfileLimits.chainringTeeth;
    const cog = ProfileLimits.cogTeeth;

    test('reads the separators riders actually type', () {
      expect(parseTeeth('34, 50', ring), [34, 50]);
      expect(parseTeeth('50/34', ring), [34, 50]);
      expect(parseTeeth('11-13-15-17', cog), [11, 13, 15, 17]);
      expect(parseTeeth('11 12 13', cog), [11, 12, 13]);
    });

    test('sorts smallest first', () {
      expect(parseTeeth('34,11,21', cog), [11, 21, 34]);
    });

    test('rejects out-of-range, repeated, empty and non-numeric input', () {
      expect(parseTeeth('34, 80', ring), isNull);
      expect(parseTeeth('11, 11, 13', cog), isNull);
      expect(parseTeeth('', cog), isNull);
      expect(parseTeeth(' , ', cog), isNull);
      expect(parseTeeth('11, big', cog), isNull);
      expect(parseTeeth('11.5, 13', cog), isNull);
    });
  });
}
