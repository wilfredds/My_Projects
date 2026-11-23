import 'package:material_ui/material_ui.dart';

/// A background/foreground pair that is always used together, so contrast can
/// be guaranteed by a test instead of by hoping callers pick a readable text
/// colour.
@immutable
final class Tone {
  const new(this.background, this.foreground);

  final Color background;
  final Color foreground;
}

/// Colours for the five PAGASA heat-index categories.
///
/// These are semantic, not brand: they are identical in light and dark
/// mode, because a warning must look the same wherever it
/// appears. Each badge is a filled shape carrying its own text colour, so it
/// does not depend on the surface behind it. Colour is never the only signal -
/// a badge always shows an icon and the category name too.
@immutable
final class HeatRiskColors extends ThemeExtension<HeatRiskColors> {
  const new({
    required this.notHazardous,
    required this.caution,
    required this.extremeCaution,
    required this.danger,
    required this.extremeDanger,
  });

  static const standard = HeatRiskColors(
    notHazardous: Tone(Color(0xFFDCE3E8), Color(0xFF1A1C1E)),
    caution: Tone(Color(0xFFFFE14D), Color(0xFF1F1B00)),
    extremeCaution: Tone(Color(0xFFFFAE1F), Color(0xFF241500)),
    danger: Tone(Color(0xFFF2600C), Color(0xFF1A0A00)),
    extremeDanger: Tone(Color(0xFFA8121A), Color(0xFFFFFFFF)),
  );

  final Tone notHazardous;
  final Tone caution;
  final Tone extremeCaution;
  final Tone danger;
  final Tone extremeDanger;

  List<Tone> get all => [
    notHazardous,
    caution,
    extremeCaution,
    danger,
    extremeDanger,
  ];

  @override
  HeatRiskColors copyWith() => this;

  // Warning colours never animate between themes: they are the same in all.
  @override
  HeatRiskColors lerp(HeatRiskColors? other, double t) => this;
}
