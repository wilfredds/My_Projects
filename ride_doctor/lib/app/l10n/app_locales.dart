import 'dart:ui';

/// The languages Ride Doctor ships, and how a device language maps onto them.
abstract final class AppLocales {
  static const english = Locale('en');
  static const filipino = Locale('fil');

  /// English first: it is the fallback when nothing matches.
  static const supported = <Locale>[english, filipino];

  /// Picks the app language from the device's ordered language preferences.
  ///
  /// Android reports Filipino as either `fil` or the older ISO 639-1 code
  /// `tl` (Tagalog), depending on the manufacturer and OS version. Flutter's
  /// default resolution does not treat those as the same language, so a
  /// Filipino-language phone reporting `tl` would silently fall back to
  /// English. We normalise it here.
  static Locale resolve(List<Locale>? deviceLocales) {
    for (final device in deviceLocales ?? const <Locale>[]) {
      final code = device.languageCode == 'tl' ? 'fil' : device.languageCode;
      for (final candidate in supported) {
        if (candidate.languageCode == code) return candidate;
      }
    }
    return english;
  }
}
