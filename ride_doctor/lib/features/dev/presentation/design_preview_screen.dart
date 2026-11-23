import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/app/theme/heat_risk_colors.dart';
import 'package:ride_doctor/l10n/l10n.dart';

/// A living style guide: the colours, type and components the app is built
/// from, on one screen, in the active theme and language.
///
/// This is a developer tool. Labels that only describe the design system
/// itself (colour-role names, the sample value) are deliberately
/// hard-coded English - the one exception to the "no hard-coded strings" rule.
/// Everything a rider will actually read comes from the ARB files.
class DesignPreviewScreen extends StatelessWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final heat = theme.extension<HeatRiskColors>()!;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.designPreviewTitle)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            const _SampleNumberCard(),
            const SizedBox(height: 16),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                FilledButton(onPressed: () {}, child: const Text('Primary')),
                FilledButton.tonal(
                  onPressed: () {},
                  child: const Text('Tonal'),
                ),
                OutlinedButton(onPressed: () {}, child: const Text('Outline')),
              ],
            ),
            const SizedBox(height: 24),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _HeatBadge(
                  tone: heat.notHazardous,
                  icon: Icons.check_circle_outline,
                  label: l10n.heatNotHazardous,
                ),
                _HeatBadge(
                  tone: heat.caution,
                  icon: Icons.wb_sunny_outlined,
                  label: l10n.heatCaution,
                ),
                _HeatBadge(
                  tone: heat.extremeCaution,
                  icon: Icons.thermostat,
                  label: l10n.heatExtremeCaution,
                ),
                _HeatBadge(
                  tone: heat.danger,
                  icon: Icons.warning_amber_rounded,
                  label: l10n.heatDanger,
                ),
                _HeatBadge(
                  tone: heat.extremeDanger,
                  icon: Icons.dangerous_outlined,
                  label: l10n.heatExtremeDanger,
                ),
              ],
            ),
            const SizedBox(height: 24),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _Swatch('primary', scheme.primary, scheme.onPrimary),
                _Swatch(
                  'primaryContainer',
                  scheme.primaryContainer,
                  scheme.onPrimaryContainer,
                ),
                _Swatch('secondary', scheme.secondary, scheme.onSecondary),
                _Swatch('tertiary', scheme.tertiary, scheme.onTertiary),
                _Swatch(
                  'surfaceContainer',
                  scheme.surfaceContainer,
                  scheme.onSurface,
                ),
                _Swatch('error', scheme.error, scheme.onError),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// How a calculated number will look everywhere in the app: label, big value
/// with its unit, a confidence chip, and a "Why?" action.
class _SampleNumberCard extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Climbing cadence - 39 x 28 at 8 km/h',
              style: theme.textTheme.labelLarge?.copyWith(
                color: scheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 4),
            Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: '45.6',
                    style: theme.textTheme.displayLarge?.copyWith(
                      color: scheme.onSurface,
                    ),
                  ),
                  TextSpan(
                    text: ' rpm',
                    style: theme.textTheme.headlineSmall?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Chip(
                  avatar: const Icon(Icons.sensors),
                  label: Text(l10n.confidenceMeasured),
                ),
                Chip(
                  avatar: const Icon(Icons.functions),
                  label: Text(l10n.confidenceEstimated),
                ),
                Chip(
                  avatar: const Icon(Icons.blur_on),
                  label: Text(l10n.confidenceRough),
                ),
                TextButton(onPressed: () {}, child: Text(l10n.whyButton)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _HeatBadge extends StatelessWidget {
  const new({required this.tone, required this.icon, required this.label});

  final Tone tone;
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: tone.background,
        borderRadius: const BorderRadius.all(Radius.circular(12)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 20, color: tone.foreground),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                label,
                style: Theme.of(context).textTheme.labelLarge
                    ?.copyWith(color: tone.foreground),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Swatch extends StatelessWidget {
  const new(this.name, this.background, this.foreground);

  final String name;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: background,
        borderRadius: const BorderRadius.all(Radius.circular(12)),
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Text(
          name,
          style: Theme.of(context).textTheme.labelMedium
              ?.copyWith(color: foreground),
        ),
      ),
    );
  }
}
