import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/app/widgets/confidence_chip.dart';
import 'package:ride_doctor/app/widgets/science_text.dart';
import 'package:ride_doctor/core/science/explained.dart';
import 'package:ride_doctor/core/science/sources.dart';
import 'package:ride_doctor/core/units/display_units.dart';
import 'package:ride_doctor/l10n/l10n.dart';

/// The "Why?" button shown beside a calculated number.
class WhyButton extends StatelessWidget {
  const new(this.explained, {super.key});

  final Explained<Object?> explained;

  @override
  Widget build(BuildContext context) => TextButton(
    onPressed: () => showWhySheet(context, explained),
    child: Text(context.l10n.whyButton),
  );
}

/// Opens the explanation of how a number was worked out: the formula in plain
/// words, what went in, how sure it is, how to improve it, and its source.
///
/// This sheet is how the app teaches (PROMPT.md 3.2). It is built entirely
/// from the [Explained] value itself, so a number can never be shown with an
/// explanation that does not match how it was actually calculated.
Future<void> showWhySheet(BuildContext context, Explained<Object?> explained) =>
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (context) => _WhySheet(explained),
    );

class _WhySheet extends StatelessWidget {
  const new(this.explained);

  final Explained<Object?> explained;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final formula = explained.formula;
    final limits = l10n.formulaLimits(formula);
    final source = sourceFor(formula);

    Widget heading(String text) => Padding(
      padding: const EdgeInsets.only(top: 20, bottom: 6),
      child: Semantics(
        header: true,
        child: Text(
          text,
          style: theme.textTheme.titleMedium?.copyWith(
            color: theme.colorScheme.primary,
          ),
        ),
      ),
    );

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      maxChildSize: 0.95,
      builder: (context, scrollController) => ListView(
        controller: scrollController,
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
        children: [
          Semantics(
            header: true,
            child: Text(
              l10n.formulaTitle(formula),
              style: theme.textTheme.headlineSmall,
            ),
          ),
          heading(l10n.whyHow),
          Text(l10n.formulaHow(formula), style: theme.textTheme.bodyLarge),
          if (explained.inputs.isNotEmpty) ...[
            heading(l10n.whyInputs),
            for (final input in explained.inputs)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Text(
                  '${l10n.inputLabel(input.quantity)}: '
                  '${formatNumber(input.value)} '
                  '${l10n.inputUnit(input.quantity)}',
                  style: theme.textTheme.bodyLarge,
                ),
              ),
          ],
          heading(l10n.whyConfidence),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: ConfidenceChip(explained.confidence),
          ),
          const SizedBox(height: 8),
          Text(
            l10n.confidenceBody(explained.confidence),
            style: theme.textTheme.bodyLarge,
          ),
          if (explained.improvements.isNotEmpty) ...[
            heading(l10n.whyImprove),
            for (final improvement in explained.improvements.toSet())
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 4, right: 8),
                      child: Icon(
                        Icons.arrow_upward,
                        size: 18,
                        color: theme.colorScheme.primary,
                      ),
                    ),
                    Expanded(
                      child: Text(
                        l10n.improvementText(improvement),
                        style: theme.textTheme.bodyLarge,
                      ),
                    ),
                  ],
                ),
              ),
          ],
          if (limits != null) ...[
            heading(l10n.whyLimits),
            Text(limits, style: theme.textTheme.bodyLarge),
          ],
          heading(l10n.whySource),
          if (source == null)
            Text(l10n.sourceNone, style: theme.textTheme.bodyLarge)
          else ...[
            Text(source.citation, style: theme.textTheme.bodyMedium),
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(
                  source.status == SourceStatus.verified
                      ? Icons.verified_outlined
                      : Icons.pending_outlined,
                  size: 18,
                  color: theme.colorScheme.onSurfaceVariant,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    l10n.sourceStatusLabel(source.status),
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 16),
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: FilledButton.tonal(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(l10n.commonClose),
            ),
          ),
        ],
      ),
    );
  }
}
