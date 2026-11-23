import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/features/race_prep/domain/race_checklist.dart';
import 'package:ride_doctor/features/race_prep/domain/skill_cards.dart';
import 'package:ride_doctor/features/race_prep/presentation/race_text.dart';
import 'package:ride_doctor/l10n/l10n.dart';

void main() {
  final english = lookupAppLocalizations(const Locale('en'));
  final filipino = lookupAppLocalizations(const Locale('fil'));

  group('raceWhen', () {
    test('names today, tomorrow and yesterday', () {
      expect(english.raceWhen(0), 'Today');
      expect(english.raceWhen(1), 'Tomorrow');
      expect(english.raceWhen(-1), 'Yesterday');
      expect(filipino.raceWhen(0), 'Ngayong araw');
      expect(filipino.raceWhen(1), 'Bukas');
      expect(filipino.raceWhen(-1), 'Kahapon');
    });

    // Regression: written as an ICU plural, Filipino showed "Bukas"
    // (tomorrow) for 2, 3, 5, 7, 8... days, because those numbers are in
    // Filipino's grammatical "one" category.
    test('every other day count shows its number, in both languages', () {
      for (final l10n in [english, filipino]) {
        for (var days = 2; days <= 400; days++) {
          expect(l10n.raceWhen(days), contains('$days'));
          expect(l10n.raceWhen(-days), contains('$days'));
          expect(l10n.raceWhen(days), isNot(l10n.raceTomorrow));
          expect(l10n.raceWhen(-days), isNot(l10n.raceYesterday));
        }
      }
    });
  });

  test('every skill card has a title, an explanation and a drill, in both '
      'languages', () {
    for (final l10n in [english, filipino]) {
      for (final card in SkillCard.values) {
        final (title, body, drill) = l10n.skillCardText(card);
        expect(title, isNotEmpty, reason: card.name);
        expect(body.length, greaterThan(40), reason: card.name);
        expect(drill.length, greaterThan(40), reason: card.name);
      }
    }
  });

  test('every checklist item has its own wording', () {
    for (final l10n in [english, filipino]) {
      final labels = ChecklistItem.values.map(l10n.checklistItemLabel).toSet();
      expect(labels, hasLength(ChecklistItem.values.length));
    }
  });

  test('clockTime is a zero-padded 24-hour time', () {
    expect(clockTime(DateTime(2027, 3, 14, 6, 5)), '06:05');
    expect(clockTime(DateTime(2027, 3, 14, 19, 30)), '19:30');
    expect(clockTime(DateTime(2027, 3, 14)), '00:00');
  });
}
