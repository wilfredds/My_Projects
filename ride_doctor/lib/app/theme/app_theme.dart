import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/app/theme/app_palette.dart';
import 'package:ride_doctor/app/theme/heat_risk_colors.dart';

/// Builds the app's Material 3 themes.
///
/// Design constraints (PROMPT.md section 11): outdoor-first - high contrast,
/// large type, touch targets of at least 48 dp, usable one-handed in sunlight.
abstract final class AppTheme {
  static const bodyFont = 'Barlow';

  /// Condensed cut for headlines and big numbers: more digits fit per line at
  /// a larger size, and long Filipino headings wrap less.
  static const displayFont = 'Barlow Condensed';

  static ColorScheme colorScheme(AppPalette palette, Brightness brightness) {
    final scheme = ColorScheme.fromSeed(
      seedColor: palette.seed,
      brightness: brightness,
      // Material's "medium contrast" level. The default (0.0) is tuned for
      // indoor screens; raising it widens the gap between text and surface
      // roles across the whole scheme, which is what sunlight needs.
      contrastLevel: 0.5,
    );
    return switch (brightness) {
      Brightness.dark => scheme.copyWith(
        primary: palette.accent,
        onPrimary: palette.onAccent,
      ),
      Brightness.light => scheme.copyWith(
        primaryContainer: palette.accent,
        onPrimaryContainer: palette.onAccent,
      ),
    };
  }

  static ThemeData build(AppPalette palette, Brightness brightness) {
    final scheme = colorScheme(palette, brightness);
    const minButtonSize = Size(64, 52);
    const buttonShape = RoundedRectangleBorder(
      borderRadius: BorderRadius.all(Radius.circular(14)),
    );
    const buttonText = TextStyle(
      fontFamily: bodyFont,
      fontSize: 17,
      fontWeight: FontWeight.w600,
    );

    return ThemeData(
      colorScheme: scheme,
      fontFamily: bodyFont,
      textTheme: _textTheme,
      // Flutter defaults to a *compact* density on desktop and web, which
      // shrinks controls below 48 dp. Pin the standard density everywhere so
      // what we test is what ships.
      visualDensity: VisualDensity.standard,
      materialTapTargetSize: MaterialTapTargetSize.padded,
      scaffoldBackgroundColor: scheme.surface,
      appBarTheme: AppBarThemeData(
        backgroundColor: scheme.surface,
        foregroundColor: scheme.onSurface,
        centerTitle: false,
        scrolledUnderElevation: 0,
        titleTextStyle: TextStyle(
          fontFamily: displayFont,
          fontSize: 30,
          fontWeight: FontWeight.w700,
          color: scheme.onSurface,
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        margin: EdgeInsets.zero,
        color: scheme.surfaceContainer,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(20)),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: minButtonSize,
          shape: buttonShape,
          textStyle: buttonText,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: minButtonSize,
          shape: buttonShape,
          textStyle: buttonText,
          side: BorderSide(color: scheme.outline, width: 1.5),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          minimumSize: const Size(48, 48),
          textStyle: buttonText,
        ),
      ),
      extensions: const [HeatRiskColors.standard],
    );
  }

  // Only the properties we change are set; ThemeData merges this over the
  // Material 3 type scale. Body sizes are one step larger than Material's
  // defaults (14/16) because the default body text is hard to read on a
  // handlebar-mounted phone.
  static const _textTheme = TextTheme(
    displayLarge: TextStyle(
      fontFamily: displayFont,
      fontWeight: FontWeight.w700,
    ),
    displayMedium: TextStyle(
      fontFamily: displayFont,
      fontWeight: FontWeight.w700,
    ),
    displaySmall: TextStyle(
      fontFamily: displayFont,
      fontWeight: FontWeight.w700,
    ),
    headlineLarge: TextStyle(
      fontFamily: displayFont,
      fontWeight: FontWeight.w700,
    ),
    headlineMedium: TextStyle(
      fontFamily: displayFont,
      fontWeight: FontWeight.w600,
    ),
    headlineSmall: TextStyle(
      fontFamily: displayFont,
      fontWeight: FontWeight.w600,
    ),
    titleLarge: TextStyle(fontWeight: FontWeight.w600),
    titleMedium: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
    bodyLarge: TextStyle(fontSize: 18, height: 1.4),
    bodyMedium: TextStyle(fontSize: 16, height: 1.4),
    bodySmall: TextStyle(fontSize: 14, height: 1.35),
    labelLarge: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
    labelMedium: TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
  );
}
