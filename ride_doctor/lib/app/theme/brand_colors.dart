import 'dart:ui';

/// The Hi-Vis palette: asphalt neutrals with the lime of cycling safety gear.
/// Chosen over a teal alternative on 2026-11-23 (docs/DECISIONS.md, ADR-0006).
abstract final class BrandColors {
  /// The colour the whole tonal scheme is generated from.
  static const seed = Color(0xFFA6D800);

  /// The signature lime, pinned by hand because generated schemes come out
  /// pastel. It is too light to be text on a white surface, so its role
  /// depends on brightness: in dark mode it is `primary`; in light mode it is
  /// `primaryContainer`, a fill that always carries [onAccent] text.
  static const accent = Color(0xFFC6F135);
  static const onAccent = Color(0xFF1B2600);
}
