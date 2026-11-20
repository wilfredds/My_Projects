import 'package:material_ui/material_ui.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'app_palette.g.dart';

/// The two candidate brand palettes proposed in Phase 0.
///
/// TEMPORARY: once one is chosen (docs/DECISIONS.md, ADR-0006) the other value,
/// [PalettePreview] and the palette switcher on the design preview screen are
/// deleted, and the theme takes no palette argument.
enum AppPalette {
  /// Asphalt neutrals with a high-visibility lime accent - the colour of
  /// cycling safety gear. Reads strongly in direct sunlight.
  hiVis(
    seed: Color(0xFFA6D800),
    accent: Color(0xFFC6F135),
    onAccent: Color(0xFF1B2600),
  ),

  /// Deep teal: calmer and more clinical, and it sits far away from the
  /// yellow-to-red heat-risk scale so brand and warnings never compete.
  monsoon(
    seed: Color(0xFF00A896),
    accent: Color(0xFF5EE0CE),
    onAccent: Color(0xFF00382F),
  );

  new({required this.seed, required this.accent, required this.onAccent});

  /// The colour the whole tonal scheme is generated from.
  final Color seed;

  /// The signature brand colour, pinned by hand because generated schemes
  /// come out pastel. It is too light to be text on a white surface, so its
  /// role depends on brightness: in dark mode it is `primary`; in light mode
  /// it is `primaryContainer`, a fill that always carries [onAccent] text.
  final Color accent;
  final Color onAccent;
}

@Riverpod(keepAlive: true)
class PalettePreview extends _$PalettePreview {
  @override
  AppPalette build() => AppPalette.hiVis;

  // A method, not a setter: riverpod state changes are actions, and the
  // generated `state` setter is deliberately protected.
  // ignore: use_setters_to_change_properties
  void select(AppPalette palette) => state = palette;
}
