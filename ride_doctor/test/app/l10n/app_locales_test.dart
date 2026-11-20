import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/app/l10n/app_locales.dart';

void main() {
  group('AppLocales.resolve', () {
    test('maps the legacy Tagalog code "tl" to Filipino', () {
      expect(
        AppLocales.resolve(const [Locale('tl', 'PH')]),
        AppLocales.filipino,
      );
    });

    test('ignores the region: en_PH is English', () {
      expect(
        AppLocales.resolve(const [Locale('en', 'PH')]),
        AppLocales.english,
      );
    });

    test('honours preference order: first supported language wins', () {
      expect(
        AppLocales.resolve(const [Locale('ja'), Locale('fil'), Locale('en')]),
        AppLocales.filipino,
      );
    });

    test('falls back to English when nothing matches', () {
      expect(AppLocales.resolve(const [Locale('ja')]), AppLocales.english);
    });

    test('falls back to English when the device reports nothing', () {
      expect(AppLocales.resolve(null), AppLocales.english);
      expect(AppLocales.resolve(const []), AppLocales.english);
    });
  });
}
