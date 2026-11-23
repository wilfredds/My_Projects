import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/core/units/display_units.dart';
import 'package:ride_doctor/features/profile/domain/number_rule.dart';
import 'package:ride_doctor/l10n/l10n.dart';

/// A number input with a unit, a "why we ask" line, and range validation.
///
/// The rule is always in metric. When the rider types in another unit, pass
/// [toMetric] and [fromMetric]: the value is converted before checking, and
/// the limits in the error message are converted back, so the message is in
/// the unit the rider is actually typing.
class AppNumberField extends StatelessWidget {
  const new({
    required this.controller,
    required this.label,
    required this.rule,
    this.unit,
    this.why,
    this.required = true,
    this.toMetric,
    this.fromMetric,
    super.key,
  });

  final TextEditingController controller;
  final String label;
  final NumberRule rule;
  final String? unit;

  /// Short "why we ask" text shown under the field.
  final String? why;
  final bool required;
  final double Function(double shown)? toMetric;
  final double Function(double metric)? fromMetric;

  String? _validate(AppLocalizations l10n, String? text) {
    if (text == null || text.trim().isEmpty) {
      return required ? l10n.errorRequired : null;
    }
    final shown = NumberRule.parse(text);
    if (shown == null) return l10n.errorNotANumber;

    // Round the displayed limits toward the valid side, so the message never
    // names a value that would itself be rejected.
    double display(double metric) => fromMetric?.call(metric) ?? metric;
    final min = formatNumber((display(rule.min) * 10).ceil() / 10);
    final max = formatNumber((display(rule.max) * 10).floor() / 10);

    return switch (rule.check(toMetric?.call(shown) ?? shown)) {
      null => null,
      NumberProblem.notWhole => l10n.errorWholeNumber,
      NumberProblem.tooLow => l10n.errorTooLow(min, unit ?? ''),
      NumberProblem.tooHigh => l10n.errorTooHigh(max, unit ?? ''),
      NumberProblem.empty || NumberProblem.notANumber => l10n.errorNotANumber,
    };
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: TextFormField(
        controller: controller,
        keyboardType: TextInputType.numberWithOptions(decimal: !rule.whole),
        textInputAction: TextInputAction.next,
        autovalidateMode: AutovalidateMode.onUserInteraction,
        validator: (text) => _validate(l10n, text),
        decoration: InputDecoration(
          labelText: required ? label : '$label (${l10n.commonOptional})',
          suffixText: unit,
          helperText: why,
          helperMaxLines: 4,
          errorMaxLines: 4,
          border: const OutlineInputBorder(),
        ),
      ),
    );
  }
}

/// A single choice from a few options, as chips that wrap onto more lines
/// when the text is large or the translation is long.
class ChoiceField<T extends Object> extends StatelessWidget {
  const new({
    required this.label,
    required this.options,
    required this.optionLabel,
    required this.value,
    required this.onChanged,
    this.why,
    this.errorText,
    super.key,
  });

  final String label;
  final List<T> options;
  final String Function(T option) optionLabel;
  final T? value;
  final ValueChanged<T> onChanged;
  final String? why;

  /// Shown in the error colour under the chips when a choice is required
  /// and missing.
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: theme.textTheme.titleMedium),
          if (why != null)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                why!,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ),
          const SizedBox(height: 4),
          Wrap(
            spacing: 8,
            children: [
              for (final option in options)
                ChoiceChip(
                  label: Text(optionLabel(option)),
                  selected: option == value,
                  onSelected: (_) => onChanged(option),
                ),
            ],
          ),
          if (errorText != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                errorText!,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.error,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// A titled card that groups related content on a screen.
class SectionCard extends StatelessWidget {
  const new({required this.title, required this.children, super.key});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Semantics(
              header: true,
              child: Text(title, style: theme.textTheme.headlineSmall),
            ),
            const SizedBox(height: 8),
            ...children,
          ],
        ),
      ),
    );
  }
}

/// Progressive profiling: instead of a blank where a number would be, say
/// exactly what to add to unlock it, with one tap to go and add it.
class PromptRow extends StatelessWidget {
  const new({
    required this.text,
    required this.actionLabel,
    required this.onPressed,
    super.key,
  });

  final String text;
  final String actionLabel;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          text,
          style: theme.textTheme.bodyLarge?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 8),
        FilledButton.tonal(onPressed: onPressed, child: Text(actionLabel)),
      ],
    );
  }
}

/// A scrolling column that builds every child immediately.
///
/// Use this, not a `ListView`, for any screen containing a `Form`. A ListView
/// only builds the rows near the viewport and throws away the ones scrolled
/// off, so a form field that is off screen when Save is pressed would not
/// exist - and would silently skip validation.
class ScrollingColumn extends StatelessWidget {
  const new({
    required this.children,
    this.padding = const EdgeInsets.fromLTRB(16, 8, 16, 24),
    super.key,
  });

  final List<Widget> children;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    padding: padding,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: children,
    ),
  );
}

/// A "label ... value" line. On a wide screen the two sit at opposite ends of
/// one line; when the text is large or the screen narrow, the value drops to
/// the next line instead of overflowing off the edge.
///
/// A `Row` with an `Expanded` label looks the same at normal size but cannot
/// do this: its value is never allowed to wrap or move, so it overflows.
class LabelValue extends StatelessWidget {
  const new(this.label, this.value, {this.style, super.key});

  final String label;
  final String value;

  /// Style for both parts; the label is additionally dimmed.
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final base = style ?? theme.textTheme.bodyLarge;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: SizedBox(
        width: double.infinity,
        child: Wrap(
          spacing: 12,
          alignment: WrapAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: base?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
            Text(value, style: base),
          ],
        ),
      ),
    );
  }
}
