import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/app/widgets/form_fields.dart';
import 'package:ride_doctor/core/app/environment.dart';
import 'package:ride_doctor/features/profile/domain/number_rule.dart';
import 'package:ride_doctor/features/race_prep/data/race_providers.dart';
import 'package:ride_doctor/features/race_prep/domain/race_debrief.dart';
import 'package:ride_doctor/features/race_prep/domain/race_limits.dart';
import 'package:ride_doctor/features/race_prep/presentation/race_text.dart';
import 'package:ride_doctor/l10n/l10n.dart';

/// A few structured questions about how the race went. Answers are choices
/// rather than free text wherever possible, so later phases can act on them:
/// "dropped on climbs, cramps" becomes input to the diagnosis and the next
/// plan, not a note nobody reads again.
class DebriefScreen extends ConsumerStatefulWidget {
  const new({required this.raceId, super.key});

  final String raceId;

  @override
  ConsumerState<DebriefScreen> createState() => _DebriefScreenState();
}

class _DebriefScreenState extends ConsumerState<DebriefScreen> {
  final _formKey = GlobalKey<FormState>();
  final _placing = TextEditingController();
  final _fieldSize = TextEditingController();
  final _wouldChange = TextEditingController();

  bool? _finished;
  DroppedWhen? _droppedWhen;
  final _struggles = <StruggleArea>{};
  final _symptoms = <RaceSymptom>{};
  var _showMissing = false;
  String? _placingError;
  var _loaded = false;

  void _load(RaceDebrief? debrief) {
    if (_loaded) return;
    _loaded = true;
    if (debrief == null) return;
    _finished = debrief.finished;
    _droppedWhen = debrief.droppedWhen;
    _struggles.addAll(debrief.struggles);
    _symptoms.addAll(debrief.symptoms);
    _placing.text = debrief.placing?.toString() ?? '';
    _fieldSize.text = debrief.fieldSize?.toString() ?? '';
    _wouldChange.text = debrief.wouldChange ?? '';
  }

  @override
  void dispose() {
    _placing.dispose();
    _fieldSize.dispose();
    _wouldChange.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final l10n = context.l10n;
    final placing = NumberRule.parse(_placing.text)?.round();
    final fieldSize = NumberRule.parse(_fieldSize.text)?.round();
    final placingBeyondField =
        placing != null && fieldSize != null && placing > fieldSize;
    final fieldsValid = _formKey.currentState!.validate();
    if (!fieldsValid ||
        _finished == null ||
        _droppedWhen == null ||
        placingBeyondField) {
      setState(() {
        _showMissing = true;
        _placingError = placingBeyondField ? l10n.debriefPlacingError : null;
      });
      return;
    }
    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);
    final note = _wouldChange.text.trim();

    final repository = await ref.read(raceRepositoryProvider.future);
    await repository.saveDebrief(
      RaceDebrief(
        raceId: widget.raceId,
        finished: _finished!,
        droppedWhen: _droppedWhen!,
        struggles: Set.of(_struggles),
        symptoms: Set.of(_symptoms),
        placing: placing,
        fieldSize: fieldSize,
        wouldChange: note.isEmpty ? null : note,
        recordedAt: ref.read(clockProvider)(),
      ),
    );
    messenger.showSnackBar(SnackBar(content: Text(l10n.commonSaved)));
    router.pop();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final debriefs = ref.watch(raceDebriefsProvider);
    if (debriefs.hasValue) _load(debriefs.value![widget.raceId]);
    String? missing(Object? value) =>
        _showMissing && value == null ? l10n.errorRequired : null;

    Widget multiChoice<T extends Object>({
      required String label,
      required List<T> options,
      required String Function(T) optionLabel,
      required Set<T> selected,
    }) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: theme.textTheme.titleMedium),
          const SizedBox(height: 4),
          Wrap(
            spacing: 8,
            children: [
              for (final option in options)
                FilterChip(
                  label: Text(optionLabel(option)),
                  selected: selected.contains(option),
                  onSelected: (on) => setState(
                    () => on ? selected.add(option) : selected.remove(option),
                  ),
                ),
            ],
          ),
        ],
      ),
    );

    return Scaffold(
      appBar: AppBar(title: Text(l10n.raceDebriefTitle)),
      body: SafeArea(
        child: !_loaded
            ? const Center(child: CircularProgressIndicator())
            : Form(
                key: _formKey,
                child: ScrollingColumn(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                  children: [
                    ChoiceField<bool>(
                      label: l10n.debriefFinished,
                      options: const [true, false],
                      optionLabel: (yes) =>
                          yes ? l10n.commonYes : l10n.commonNo,
                      value: _finished,
                      errorText: missing(_finished),
                      onChanged: (finished) =>
                          setState(() => _finished = finished),
                    ),
                    AppNumberField(
                      controller: _placing,
                      label: l10n.debriefPlacing,
                      rule: RaceLimits.placing,
                      required: false,
                    ),
                    AppNumberField(
                      controller: _fieldSize,
                      label: l10n.debriefFieldSize,
                      rule: RaceLimits.placing,
                      required: false,
                    ),
                    InlineError(_placingError),
                    ChoiceField<DroppedWhen>(
                      label: l10n.debriefDropped,
                      options: DroppedWhen.values,
                      optionLabel: l10n.droppedLabel,
                      value: _droppedWhen,
                      errorText: missing(_droppedWhen),
                      onChanged: (when) => setState(() => _droppedWhen = when),
                    ),
                    multiChoice(
                      label: l10n.debriefStruggles,
                      options: StruggleArea.values,
                      optionLabel: l10n.struggleLabel,
                      selected: _struggles,
                    ),
                    multiChoice(
                      label: l10n.debriefSymptoms,
                      options: RaceSymptom.values,
                      optionLabel: l10n.symptomLabel,
                      selected: _symptoms,
                    ),
                    // The question is a heading above the box, not the box's
                    // label: a floating label is one line and would cut a
                    // question this long short.
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        l10n.debriefWouldChange,
                        style: theme.textTheme.titleMedium,
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: TextFormField(
                        controller: _wouldChange,
                        maxLines: 3,
                        maxLength: 500,
                        textCapitalization: TextCapitalization.sentences,
                        decoration: InputDecoration(
                          labelText: l10n.commonOptional,
                          alignLabelWithHint: true,
                          border: const OutlineInputBorder(),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    FilledButton(
                      onPressed: _save,
                      child: Text(l10n.commonSave),
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}
