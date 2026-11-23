import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/app/widgets/science_text.dart';
import 'package:ride_doctor/core/science/confidence.dart';
import 'package:ride_doctor/l10n/l10n.dart';

/// The small label that sits beside every calculated number and says how far
/// to trust it: an icon plus a word, never colour alone.
class ConfidenceChip extends StatelessWidget {
  const new(this.confidence, {super.key});

  final Confidence confidence;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.surface,
        border: Border.all(color: scheme.outline),
        borderRadius: const BorderRadius.all(Radius.circular(10)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(confidenceIcon(confidence), size: 18, color: scheme.primary),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                context.l10n.confidenceLabel(confidence),
                style: theme.textTheme.labelMedium?.copyWith(
                  color: scheme.onSurface,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
