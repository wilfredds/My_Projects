import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/app/widgets/form_fields.dart';
import 'package:ride_doctor/core/app/environment.dart';
import 'package:ride_doctor/core/units/display_units.dart';
import 'package:ride_doctor/features/profile/domain/number_rule.dart';
import 'package:ride_doctor/features/race_prep/data/race_providers.dart';
import 'package:ride_doctor/features/race_prep/domain/race_event.dart';
import 'package:ride_doctor/features/race_prep/domain/race_limits.dart';
import 'package:ride_doctor/features/race_prep/presentation/race_text.dart';
import 'package:ride_doctor/l10n/l10n.dart';

/// Adds a race, or edits the one with [raceId]. Only the name, type, date and
/// start time are required: they are enough for the countdown and the
/// timeline. A date in the past is allowed, so a race already ridden can be
/// added just to record its debrief.
class RaceFormScreen extends ConsumerStatefulWidget {
  const new({this.raceId, super.key});

  final String? raceId;

  @override
  ConsumerState<RaceFormScreen> createState() => _RaceFormScreenState();
}

class _RaceFormScreenState extends ConsumerState<RaceFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _time = TextEditingController();
  final _location = TextEditingController();
  final _travel = TextEditingController(text: '30');
  final _distance = TextEditingController();
  final _duration = TextEditingController();
  final _laps = TextEditingController();
  final _lapLength = TextEditingController();
  final _corners = TextEditingController();
  final _elevation = TextEditingController();
  final _category = TextEditingController();
  final _rules = TextEditingController();

  RaceType? _type;
  DateTime? _date;
  var _reconAllowed = true;
  var _showMissing = false;
  var _loaded = false;

  void _load(RaceEvent race) {
    if (_loaded) return;
    _loaded = true;
    String optional(num? value) => value == null ? '' : formatNumber(value);
    _name.text = race.name;
    _type = race.type;
    _date = DateTime(
      race.startsAt.year,
      race.startsAt.month,
      race.startsAt.day,
    );
    _time.text = clockTime(race.startsAt);
    _location.text = race.location ?? '';
    _travel.text = '${race.travelMinutes}';
    _reconAllowed = race.reconAllowed;
    _distance.text = optional(race.distanceKm);
    _duration.text = optional(race.durationMinutes);
    _laps.text = optional(race.laps);
    _lapLength.text = optional(race.lapLengthKm);
    _corners.text = optional(race.cornerCount);
    _elevation.text = optional(race.elevationGainM);
    _category.text = race.category ?? '';
    _rules.text = race.rulesNotes ?? '';
  }

  @override
  void dispose() {
    for (final controller in [
      _name,
      _time,
      _location,
      _travel,
      _distance,
      _duration,
      _laps,
      _lapLength,
      _corners,
      _elevation,
      _category,
      _rules,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = ref.read(clockProvider)();
    final today = DateTime(now.year, now.month, now.day);
    final picked = await showDatePicker(
      context: context,
      initialDate: _date ?? today,
      firstDate: DateTime(today.year - 2),
      lastDate: DateTime(today.year + 3, 12, 31),
      currentDate: today,
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _save() async {
    final fieldsValid = _formKey.currentState!.validate();
    if (!fieldsValid || _type == null || _date == null) {
      setState(() => _showMissing = true);
      return;
    }
    final l10n = context.l10n;
    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);
    final (hour, minute) = parseClockTime(_time.text)!;
    final date = _date!;
    String? text(TextEditingController c) =>
        c.text.trim().isEmpty ? null : c.text.trim();
    double? number(TextEditingController c) => NumberRule.parse(c.text);

    final repository = await ref.read(raceRepositoryProvider.future);
    await repository.saveRace(
      RaceEvent(
        id: widget.raceId ?? ref.read(idGeneratorProvider)(),
        name: _name.text.trim(),
        type: _type!,
        startsAt: DateTime(date.year, date.month, date.day, hour, minute),
        location: text(_location),
        travelMinutes: number(_travel)!.round(),
        reconAllowed: _reconAllowed,
        distanceKm: number(_distance),
        durationMinutes: number(_duration)?.round(),
        laps: number(_laps)?.round(),
        lapLengthKm: number(_lapLength),
        cornerCount: number(_corners)?.round(),
        elevationGainM: number(_elevation)?.round(),
        category: text(_category),
        rulesNotes: text(_rules),
      ),
    );
    messenger.showSnackBar(SnackBar(content: Text(l10n.commonSaved)));
    router.pop();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final raceId = widget.raceId;
    final editing = raceId != null;
    if (editing) {
      final race = ref.watch(raceProvider(raceId)).value;
      if (race != null) _load(race);
    }
    final ready = !editing || _loaded;
    final date = _date;

    Widget textField(
      TextEditingController controller,
      String label, {
      int maxLines = 1,
    }) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: TextFormField(
        controller: controller,
        maxLines: maxLines,
        textCapitalization: TextCapitalization.sentences,
        decoration: InputDecoration(
          labelText: '$label (${l10n.commonOptional})',
          border: const OutlineInputBorder(),
        ),
      ),
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(editing ? l10n.raceFormEditTitle : l10n.raceFormAddTitle),
      ),
      body: SafeArea(
        child: !ready
            ? const Center(child: CircularProgressIndicator())
            : Form(
                key: _formKey,
                child: ScrollingColumn(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: TextFormField(
                        controller: _name,
                        textCapitalization: TextCapitalization.words,
                        autovalidateMode: AutovalidateMode.onUserInteraction,
                        validator: (text) {
                          final name = text?.trim() ?? '';
                          if (name.isEmpty) return l10n.errorRequired;
                          if (name.length > RaceLimits.maxNameLength) {
                            return l10n.errorNameTooLong(
                              RaceLimits.maxNameLength,
                            );
                          }
                          return null;
                        },
                        decoration: InputDecoration(
                          labelText: l10n.raceFieldName,
                          border: const OutlineInputBorder(),
                        ),
                      ),
                    ),
                    ChoiceField<RaceType>(
                      label: l10n.raceFieldType,
                      options: RaceType.values,
                      optionLabel: l10n.raceTypeLabel,
                      value: _type,
                      errorText: _showMissing && _type == null
                          ? l10n.errorRequired
                          : null,
                      onChanged: (type) => setState(() => _type = type),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      l10n.raceFieldDate,
                      style: theme.textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: OutlinedButton.icon(
                        onPressed: _pickDate,
                        icon: const Icon(Icons.calendar_today_outlined),
                        label: Text(
                          date == null
                              ? l10n.raceFieldPickDate
                              : MaterialLocalizations.of(context)
                                    .formatFullDate(date),
                        ),
                      ),
                    ),
                    InlineError(
                      _showMissing && date == null
                          ? l10n.errorDateRequired
                          : null,
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: TextFormField(
                        controller: _time,
                        keyboardType: TextInputType.datetime,
                        autovalidateMode: AutovalidateMode.onUserInteraction,
                        validator: (text) {
                          if (text == null || text.trim().isEmpty) {
                            return l10n.errorRequired;
                          }
                          return parseClockTime(text) == null
                              ? l10n.errorTime
                              : null;
                        },
                        decoration: InputDecoration(
                          labelText: l10n.raceFieldTime,
                          helperText: l10n.raceFieldTimeHint,
                          helperMaxLines: 2,
                          errorMaxLines: 3,
                          border: const OutlineInputBorder(),
                        ),
                      ),
                    ),
                    AppNumberField(
                      controller: _travel,
                      label: l10n.raceFieldTravel,
                      unit: l10n.unitMinutes,
                      rule: RaceLimits.travelMinutes,
                    ),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(l10n.raceFieldRecon),
                      value: _reconAllowed,
                      onChanged: (allowed) =>
                          setState(() => _reconAllowed = allowed),
                    ),
                    const Divider(height: 32),
                    Semantics(
                      header: true,
                      child: Text(
                        l10n.raceFormDetails,
                        style: theme.textTheme.titleMedium?.copyWith(
                          color: theme.colorScheme.primary,
                        ),
                      ),
                    ),
                    textField(_location, l10n.raceFieldLocation),
                    AppNumberField(
                      controller: _distance,
                      label: l10n.raceFieldDistance,
                      unit: l10n.unitKm,
                      rule: RaceLimits.distanceKm,
                      required: false,
                    ),
                    AppNumberField(
                      controller: _duration,
                      label: l10n.raceFieldDuration,
                      unit: l10n.unitMinutes,
                      rule: RaceLimits.durationMinutes,
                      required: false,
                    ),
                    AppNumberField(
                      controller: _laps,
                      label: l10n.raceFieldLaps,
                      rule: RaceLimits.laps,
                      required: false,
                    ),
                    AppNumberField(
                      controller: _lapLength,
                      label: l10n.raceFieldLapLength,
                      unit: l10n.unitKm,
                      rule: RaceLimits.lapLengthKm,
                      required: false,
                    ),
                    AppNumberField(
                      controller: _corners,
                      label: l10n.raceFieldCorners,
                      rule: RaceLimits.cornerCount,
                      required: false,
                    ),
                    AppNumberField(
                      controller: _elevation,
                      label: l10n.raceFieldElevation,
                      unit: l10n.unitMetres,
                      rule: RaceLimits.elevationGainM,
                      required: false,
                    ),
                    textField(_category, l10n.raceFieldCategory),
                    textField(_rules, l10n.raceFieldRules, maxLines: 3),
                    const SizedBox(height: 16),
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
