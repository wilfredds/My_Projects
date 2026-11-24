import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/app/widgets/form_fields.dart';
import 'package:ride_doctor/core/app/environment.dart';
import 'package:ride_doctor/core/database/database_providers.dart';
import 'package:ride_doctor/core/units/display_units.dart';
import 'package:ride_doctor/features/onboarding/data/onboarding_saver.dart';
import 'package:ride_doctor/features/onboarding/domain/consent.dart';
import 'package:ride_doctor/features/onboarding/domain/readiness.dart';
import 'package:ride_doctor/features/onboarding/presentation/onboarding_text.dart';
import 'package:ride_doctor/features/profile/domain/bike.dart';
import 'package:ride_doctor/features/profile/domain/number_rule.dart';
import 'package:ride_doctor/features/profile/domain/rider_profile.dart';
import 'package:ride_doctor/features/profile/presentation/profile_text.dart';
import 'package:ride_doctor/features/settings/domain/app_settings.dart';
import 'package:ride_doctor/features/settings/presentation/settings_controller.dart';
import 'package:ride_doctor/l10n/l10n.dart';

/// First-run setup in four steps: about you, your riding, readiness check,
/// consents. Only the essentials are asked here; everything else is requested
/// later, when a feature can use it.
///
/// Nothing is written to storage until the last step, after the rider has
/// agreed to health data being kept. Until then the answers live only in
/// this widget's memory.
class OnboardingScreen extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  static const _stepCount = 4;

  final _formKeys = [GlobalKey<FormState>(), GlobalKey<FormState>()];
  final _scrollController = ScrollController();

  final _name = TextEditingController();
  final _birthYear = TextEditingController();
  final _height = TextEditingController();
  final _weight = TextEditingController();
  final _yearsRiding = TextEditingController();
  final _ridesPerWeek = TextEditingController();
  final _typicalRide = TextEditingController();
  final _hoursPerWeek = TextEditingController();

  BikeType? _bikeType;
  RidingGoal? _goal;
  final _answers = <ReadinessQuestion, bool>{};
  final Map<ConsentKind, bool> _consents = {
    for (final kind in ConsentKind.values) kind: false,
  };

  var _step = 0;

  /// Turns on the "you missed this" messages for the current step, only after
  /// the rider has tried to move on - not while they are still filling it in.
  var _showMissing = false;
  var _saving = false;

  @override
  void dispose() {
    for (final controller in [
      _name,
      _birthYear,
      _height,
      _weight,
      _yearsRiding,
      _ridesPerWeek,
      _typicalRide,
      _hoursPerWeek,
      _scrollController,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  /// The step widgets below are separate classes (for readability) but share
  /// this state; they change it through here so the screen rebuilds.
  void _update(VoidCallback change) => setState(change);

  bool get _stepIsValid => switch (_step) {
    0 => _formKeys[0].currentState!.validate(),
    1 =>
      _formKeys[1].currentState!.validate() &&
          _bikeType != null &&
          _goal != null,
    2 => ReadinessQuestion.values.every(_answers.containsKey),
    _ => _consents[ConsentKind.healthData]!,
  };

  void _goTo(int step) {
    setState(() {
      _step = step;
      _showMissing = false;
    });
    if (_scrollController.hasClients) _scrollController.jumpTo(0);
  }

  Future<void> _next() async {
    FocusScope.of(context).unfocus();
    if (!_stepIsValid) {
      setState(() => _showMissing = true);
      return;
    }
    if (_step < _stepCount - 1) {
      _goTo(_step + 1);
      return;
    }
    await _finish();
  }

  Future<void> _finish() async {
    final l10n = context.l10n;
    final messenger = ScaffoldMessenger.of(context);
    final units = _units;
    setState(() => _saving = true);
    try {
      final saver = await ref.read(onboardingSaverProvider.future);
      await saver.save(
        profile: RiderProfile(
          displayName: _name.text.trim(),
          birthYear: NumberRule.parse(_birthYear.text)!.round(),
          heightCm: units.heightToCm(NumberRule.parse(_height.text)!),
          weightKg: units.weightToKg(NumberRule.parse(_weight.text)!),
          yearsRiding: NumberRule.parse(_yearsRiding.text)!,
          ridesPerWeek: NumberRule.parse(_ridesPerWeek.text)!.round(),
          typicalRideMinutes: NumberRule.parse(_typicalRide.text)!.round(),
          hoursPerWeek: NumberRule.parse(_hoursPerWeek.text)!,
          goal: _goal!,
        ),
        bikeType: _bikeType!,
        readinessAnswers: Map.of(_answers),
        consentChoices: Map.of(_consents),
      );
      // No navigation here: saving the profile makes the router leave
      // onboarding by itself (see app_router.dart).
    } on Object {
      if (!mounted) return;
      setState(() => _saving = false);
      messenger.showSnackBar(SnackBar(content: Text(l10n.onboardingSaveError)));
    }
  }

  DisplayUnits get _units => DisplayUnits(
    metric:
        ref.read(settingsControllerProvider).unitSystem == UnitSystem.metric,
  );

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final title = [
      l10n.onboardingAboutTitle,
      l10n.onboardingRidingTitle,
      l10n.onboardingReadinessTitle,
      l10n.onboardingConsentTitle,
    ][_step];

    return Scaffold(
      appBar: AppBar(title: Text(title), automaticallyImplyLeading: false),
      body: SafeArea(
        child: Column(
          children: [
            LinearProgressIndicator(
              value: (_step + 1) / _stepCount,
              semanticsLabel: l10n.onboardingStep(_step + 1, _stepCount),
            ),
            Expanded(
              child: SingleChildScrollView(
                controller: _scrollController,
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.onboardingStep(_step + 1, _stepCount),
                      style: theme.textTheme.labelLarge?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 8),
                    // IndexedStack keeps every step's fields alive, so going
                    // Back never loses what was typed.
                    IndexedStack(
                      index: _step,
                      children: [
                        _AboutStep(state: this),
                        _RidingStep(state: this),
                        _ReadinessStep(state: this),
                        _ConsentStep(state: this),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              // OverflowBar puts the buttons side by side, or stacks them when
              // large text makes them too wide for one line.
              child: OverflowBar(
                alignment: _step > 0
                    ? MainAxisAlignment.spaceBetween
                    : MainAxisAlignment.end,
                overflowAlignment: OverflowBarAlignment.end,
                overflowSpacing: 8,
                children: [
                  if (_step > 0)
                    OutlinedButton(
                      onPressed: _saving ? null : () => _goTo(_step - 1),
                      child: Text(l10n.commonBack),
                    ),
                  FilledButton(
                    onPressed: _saving ? null : _next,
                    child: Text(
                      _step == _stepCount - 1
                          ? l10n.onboardingFinish
                          : l10n.commonNext,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Intro extends StatelessWidget {
  const new(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text,
        style: theme.textTheme.bodyLarge?.copyWith(
          color: theme.colorScheme.onSurfaceVariant,
        ),
      ),
    );
  }
}

class _AboutStep extends ConsumerWidget {
  const new({required this.state});

  final _OnboardingScreenState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final unitSystem = ref.watch(
      settingsControllerProvider.select((settings) => settings.unitSystem),
    );
    final units = DisplayUnits(metric: unitSystem == UnitSystem.metric);
    final currentYear = ref.watch(clockProvider)().year;

    return Form(
      key: state._formKeys[0],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Intro(l10n.onboardingAboutIntro),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: TextFormField(
              controller: state._name,
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.next,
              autovalidateMode: AutovalidateMode.onUserInteraction,
              validator: (text) {
                final name = text?.trim() ?? '';
                if (name.isEmpty) return l10n.errorRequired;
                if (name.length > ProfileLimits.maxNameLength) {
                  return l10n.errorNameTooLong(ProfileLimits.maxNameLength);
                }
                return null;
              },
              decoration: InputDecoration(
                labelText: l10n.fieldName,
                helperText: l10n.fieldNameWhy,
                helperMaxLines: 3,
                border: const OutlineInputBorder(),
              ),
            ),
          ),
          AppNumberField(
            controller: state._birthYear,
            label: l10n.fieldBirthYear,
            why: l10n.fieldBirthYearWhy,
            rule: ProfileLimits.birthYear(currentYear: currentYear),
          ),
          ChoiceField<UnitSystem>(
            label: l10n.fieldUnits,
            options: UnitSystem.values,
            optionLabel: (system) => switch (system) {
              UnitSystem.metric => l10n.unitsMetric,
              UnitSystem.imperial => l10n.unitsImperial,
            },
            value: unitSystem,
            onChanged: (system) => ref
                .read(settingsControllerProvider.notifier)
                .setUnitSystem(system),
          ),
          AppNumberField(
            controller: state._height,
            label: l10n.fieldHeight,
            why: l10n.fieldHeightWhy,
            unit: units.heightUnit,
            rule: ProfileLimits.heightCm,
            toMetric: units.heightToCm,
            fromMetric: units.heightFromCm,
          ),
          AppNumberField(
            controller: state._weight,
            label: l10n.fieldWeight,
            why: l10n.fieldWeightWhy,
            unit: units.weightUnit,
            rule: ProfileLimits.weightKg,
            toMetric: units.weightToKg,
            fromMetric: units.weightFromKg,
          ),
        ],
      ),
    );
  }
}

class _RidingStep extends StatelessWidget {
  const new({required this.state});

  final _OnboardingScreenState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    // Only build the "required" messages once the rider has tried to go on.
    String? missing(Object? value) =>
        state._showMissing && value == null ? l10n.errorRequired : null;

    return Form(
      key: state._formKeys[1],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Intro(l10n.onboardingRidingIntro),
          ChoiceField<BikeType>(
            label: l10n.fieldBikeType,
            options: BikeType.values,
            optionLabel: l10n.bikeTypeLabel,
            value: state._bikeType,
            errorText: missing(state._bikeType),
            onChanged: (type) => state._update(() => state._bikeType = type),
          ),
          ChoiceField<RidingGoal>(
            label: l10n.fieldGoal,
            options: RidingGoal.values,
            optionLabel: l10n.goalLabel,
            value: state._goal,
            errorText: missing(state._goal),
            onChanged: (goal) => state._update(() => state._goal = goal),
          ),
          AppNumberField(
            controller: state._yearsRiding,
            label: l10n.fieldYearsRiding,
            unit: l10n.unitYears,
            rule: ProfileLimits.yearsRiding,
          ),
          AppNumberField(
            controller: state._ridesPerWeek,
            label: l10n.fieldRidesPerWeek,
            rule: ProfileLimits.ridesPerWeek,
          ),
          AppNumberField(
            controller: state._typicalRide,
            label: l10n.fieldTypicalRide,
            unit: l10n.unitMinutes,
            rule: ProfileLimits.typicalRideMinutes,
          ),
          AppNumberField(
            controller: state._hoursPerWeek,
            label: l10n.fieldHoursPerWeek,
            unit: l10n.unitHours,
            rule: ProfileLimits.hoursPerWeek,
          ),
        ],
      ),
    );
  }
}

class _ReadinessStep extends StatelessWidget {
  const new({required this.state});

  final _OnboardingScreenState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final anyYes = state._answers.values.any((yes) => yes);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Intro(l10n.onboardingReadinessIntro),
        for (final question in ReadinessQuestion.values)
          ChoiceField<bool>(
            label: l10n.readinessQuestionText(question),
            options: const [true, false],
            optionLabel: (yes) => yes ? l10n.commonYes : l10n.commonNo,
            value: state._answers[question],
            errorText:
                state._showMissing && !state._answers.containsKey(question)
                ? l10n.readinessUnanswered
                : null,
            onChanged: (yes) =>
                state._update(() => state._answers[question] = yes),
          ),
        if (anyYes) const ReadinessAdvice(),
      ],
    );
  }
}

/// The recommendation shown whenever any readiness answer is "yes". It
/// advises; it never blocks and never diagnoses (PROMPT.md 3.3).
class ReadinessAdvice extends StatelessWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: scheme.tertiaryContainer,
          borderRadius: const BorderRadius.all(Radius.circular(16)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                Icons.medical_services_outlined,
                color: scheme.onTertiaryContainer,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.readinessAdviceTitle,
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: scheme.onTertiaryContainer,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      l10n.readinessAdviceBody,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: scheme.onTertiaryContainer,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ConsentStep extends StatelessWidget {
  const new({required this.state});

  final _OnboardingScreenState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final healthMissing =
        state._showMissing && !state._consents[ConsentKind.healthData]!;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Intro(
          state.ref.watch(appStorageProvider).persists
              ? l10n.onboardingConsentIntro
              : l10n.webPreviewNotice,
        ),
        for (final kind in ConsentKind.values)
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(l10n.consentTitle(kind)),
            subtitle: Text(l10n.consentBody(kind)),
            value: state._consents[kind]!,
            onChanged: (granted) =>
                state._update(() => state._consents[kind] = granted),
          ),
        if (healthMissing)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              l10n.consentHealthRequired,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.error,
              ),
            ),
          ),
        const SizedBox(height: 16),
        Text(l10n.disclaimerTitle, style: theme.textTheme.titleMedium),
        const SizedBox(height: 4),
        Text(
          l10n.disclaimerBody,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}
