import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/app/theme/heat_risk_colors.dart';
import 'package:ride_doctor/app/widgets/science_text.dart';
import 'package:ride_doctor/core/science/heat_index.dart';
import 'package:ride_doctor/l10n/l10n.dart';

/// A PAGASA heat category as a filled badge: colour, icon and name together,
/// so it reads without relying on colour.
class HeatBadge extends StatelessWidget {
  const new(this.risk, {super.key});

  final HeatRisk risk;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tone = theme.extension<HeatRiskColors>()!.all[risk.index];
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
            Icon(heatRiskIcon(risk), size: 20, color: tone.foreground),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                context.l10n.heatRiskLabel(risk),
                style: theme.textTheme.labelLarge?.copyWith(
                  color: tone.foreground,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
