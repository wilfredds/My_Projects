import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/app/theme/app_palette.dart';
import 'package:ride_doctor/app/theme/app_theme.dart';
import 'package:ride_doctor/app/theme/heat_risk_colors.dart';

/// WCAG 2.x contrast ratio between two opaque colours, from 1 (identical) to
/// 21 (black on white). `computeLuminance` implements the WCAG relative
/// luminance formula.
double contrast(Color a, Color b) {
  final la = a.computeLuminance();
  final lb = b.computeLuminance();
  final lighter = la > lb ? la : lb;
  final darker = la > lb ? lb : la;
  return (lighter + 0.05) / (darker + 0.05);
}

/// WCAG AA for normal-size text.
const minTextContrast = 4.5;

void main() {
  for (final palette in AppPalette.values) {
    for (final brightness in Brightness.values) {
      group('${palette.name} ${brightness.name}', () {
        final s = AppTheme.colorScheme(palette, brightness);
        final pairs = <String, (Color, Color)>{
          'onPrimary on primary': (s.onPrimary, s.primary),
          'onPrimaryContainer on primaryContainer': (
            s.onPrimaryContainer,
            s.primaryContainer,
          ),
          'onSecondary on secondary': (s.onSecondary, s.secondary),
          'onSecondaryContainer on secondaryContainer': (
            s.onSecondaryContainer,
            s.secondaryContainer,
          ),
          'onTertiary on tertiary': (s.onTertiary, s.tertiary),
          'onError on error': (s.onError, s.error),
          'onSurface on surface': (s.onSurface, s.surface),
          'onSurfaceVariant on surface': (s.onSurfaceVariant, s.surface),
          'onSurface on surfaceContainer': (s.onSurface, s.surfaceContainer),
          'onSurfaceVariant on surfaceContainer': (
            s.onSurfaceVariant,
            s.surfaceContainer,
          ),
          // Primary is also used as a text/icon colour (section headings).
          'primary on surface': (s.primary, s.surface),
          'error on surface': (s.error, s.surface),
        };

        for (final MapEntry(key: name, value: (foreground, background))
            in pairs.entries) {
          test('$name is at least $minTextContrast:1', () {
            expect(
              contrast(foreground, background),
              greaterThanOrEqualTo(minTextContrast),
            );
          });
        }
      });
    }
  }

  group('heat risk badges', () {
    const names = [
      'notHazardous',
      'caution',
      'extremeCaution',
      'danger',
      'extremeDanger',
    ];
    final tones = HeatRiskColors.standard.all;

    for (var i = 0; i < tones.length; i++) {
      test('${names[i]} text is at least $minTextContrast:1', () {
        expect(
          contrast(tones[i].foreground, tones[i].background),
          greaterThanOrEqualTo(minTextContrast),
        );
      });
    }

    test('every theme carries the heat colours', () {
      for (final palette in AppPalette.values) {
        for (final brightness in Brightness.values) {
          expect(
            AppTheme.build(palette, brightness).extension<HeatRiskColors>(),
            isNotNull,
          );
        }
      }
    });
  });

  test('contrast() matches the WCAG reference values', () {
    expect(contrast(Colors.black, Colors.white), closeTo(21, 0.001));
    expect(contrast(Colors.white, Colors.white), closeTo(1, 0.001));
  });
}
