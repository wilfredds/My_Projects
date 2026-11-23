import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/app/router/app_router.dart';
import 'package:ride_doctor/app/widgets/confidence_chip.dart';
import 'package:ride_doctor/app/widgets/form_fields.dart';
import 'package:ride_doctor/app/widgets/heat_badge.dart';
import 'package:ride_doctor/app/widgets/science_text.dart';
import 'package:ride_doctor/app/widgets/why_sheet.dart';
import 'package:ride_doctor/core/science/climb.dart';
import 'package:ride_doctor/core/science/confidence.dart';
import 'package:ride_doctor/core/science/explained.dart';
import 'package:ride_doctor/core/science/gearing.dart';
import 'package:ride_doctor/core/science/heat_index.dart';
import 'package:ride_doctor/core/science/zones.dart';
import 'package:ride_doctor/core/units/display_units.dart';
import 'package:ride_doctor/features/calculators/domain/my_numbers.dart';
import 'package:ride_doctor/features/calculators/presentation/my_numbers_provider.dart';
import 'package:ride_doctor/features/profile/data/profile_providers.dart';
import 'package:ride_doctor/features/settings/domain/app_settings.dart';
import 'package:ride_doctor/features/settings/presentation/settings_controller.dart';
import 'package:ride_doctor/l10n/l10n.dart';

/// Every personal number the app can calculate, each with its unit, a
/// confidence chip and a "Why?" sheet. Where a number needs information the
/// rider has not given yet, the card says what to add instead.
class MyNumbersScreen extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<MyNumbersScreen> createState() => _MyNumbersScreenState();
}

class _MyNumbersScreenState extends ConsumerState<MyNumbersScreen> {
  // What-if inputs, always held in metric and converted for display.
  double _gearSpeedKmh = 10;
  double _gradePercent = 5;
  Effort _effort = Effort.steady;
  double _temperatureC = 32;
  double _humidityPercent = 70;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final numbers = ref.watch(myNumbersProvider);
    final profile = ref.watch(riderProfileProvider).value;
    final units = DisplayUnits(
      metric:
          ref.watch(settingsControllerProvider.select((s) => s.unitSystem)) ==
          UnitSystem.metric,
    );

    return Scaffold(
      appBar: AppBar(title: Text(l10n.navNumbers)),
      body: SafeArea(
        child: numbers == null || profile == null
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  _heartCard(context, numbers),
                  const SizedBox(height: 16),
                  _powerCard(context, numbers),
                  const SizedBox(height: 16),
                  _saddleCard(context, numbers, units),
                  const SizedBox(height: 16),
                  _gearCard(context, numbers, units),
                  const SizedBox(height: 16),
                  _climbCard(
                    context,
                    numbers,
                    units,
                    riderMassKg: profile.weightKg,
                    ftpWatts: profile.ftpWatts,
                  ),
                  const SizedBox(height: 16),
                  _heatCard(context, units),
                ],
              ),
      ),
    );
  }

  Widget _heartCard(BuildContext context, MyNumbers numbers) {
    final l10n = context.l10n;
    return SectionCard(
      title: l10n.numbersHeartTitle,
      children: [
        _BigNumber(
          label: l10n.numbersMaxHr,
          value: '${numbers.maxHr.value}',
          unit: 'bpm',
          explained: numbers.maxHr,
        ),
        const Divider(height: 32),
        _ZoneTable(
          title: l10n.numbersHrZones,
          unit: 'bpm',
          zones: numbers.hrZones,
        ),
      ],
    );
  }

  Widget _powerCard(BuildContext context, MyNumbers numbers) {
    final l10n = context.l10n;
    final zones = numbers.powerZones;
    final ratio = numbers.wattsPerKg;
    return SectionCard(
      title: l10n.numbersPowerTitle,
      children: [
        if (zones == null || ratio == null)
          PromptRow(
            text: l10n.numbersPowerPrompt,
            actionLabel: l10n.numbersAddDetails,
            onPressed: () => context.push(AppRoutes.editRider),
          )
        else ...[
          _BigNumber(
            label: l10n.numbersWattsPerKg,
            value: formatNumber(ratio.value, decimals: 2),
            unit: 'W/kg',
            explained: ratio,
          ),
          const Divider(height: 32),
          _ZoneTable(title: l10n.numbersPowerZones, unit: 'W', zones: zones),
        ],
      ],
    );
  }

  Widget _saddleCard(
    BuildContext context,
    MyNumbers numbers,
    DisplayUnits units,
  ) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final start = numbers.saddleHeightStart;
    final difference = numbers.saddleHeightDifferenceMm;

    String? comparison() {
      if (difference == null) return null;
      // Within a couple of millimetres is the same height for any practical
      // purpose - a tape measure is not more precise than that.
      if (difference.abs() < 3) return l10n.numbersSaddleSame;
      final amount = formatNumber(units.lengthFromMm(difference.abs()));
      return difference > 0
          ? l10n.numbersSaddleHigher(amount, units.lengthUnit)
          : l10n.numbersSaddleLower(amount, units.lengthUnit);
    }

    return SectionCard(
      title: l10n.numbersSaddleTitle,
      children: [
        if (start == null)
          PromptRow(
            text: l10n.numbersSaddlePrompt,
            actionLabel: l10n.numbersAddDetails,
            onPressed: () => context.push(AppRoutes.editRider),
          )
        else ...[
          _BigNumber(
            label: l10n.numbersSaddleStart,
            value: formatNumber(units.lengthFromMm(start.value)),
            unit: units.lengthUnit,
            explained: start,
          ),
          if (comparison() case final text?)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(text, style: theme.textTheme.bodyLarge),
            ),
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(
              l10n.numbersSaddleAdvice,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _gearCard(
    BuildContext context,
    MyNumbers numbers,
    DisplayUnits units,
  ) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final circumference = numbers.wheelCircumference;
    final drivetrain = numbers.drivetrain;

    if (circumference == null || drivetrain == null) {
      return SectionCard(
        title: l10n.numbersGearTitle,
        children: [
          PromptRow(
            text: l10n.numbersGearPrompt,
            actionLabel: l10n.todayAddBike,
            onPressed: () => context.push(AppRoutes.editBike),
          ),
        ],
      );
    }

    final gears = allGears(
      chainrings: drivetrain.chainrings,
      cogs: drivetrain.cogs,
    );
    // The table inherits its trust from the wheel size and from whether the
    // cogs are confirmed, exactly like the climb prediction does.
    final table = Explained<List<Gear>>(
      value: gears,
      confidence: Confidence.weakest([
        circumference.confidence,
        if (!drivetrain.cogsConfirmed) Confidence.rough,
      ]),
      formula: Formula.gearCadence,
      inputs: [Input(Quantity.circumferenceMm, circumference.value)],
      improvements: [
        ...circumference.improvements,
        if (!drivetrain.cogsConfirmed) Improvement.confirmCogs,
      ],
    );

    int cadenceAt(Gear gear) => gear
        .cadenceRpm(
          speedKmh: _gearSpeedKmh,
          circumferenceMm: circumference.value,
        )
        .round();

    return SectionCard(
      title: l10n.numbersGearTitle,
      children: [
        _BigNumber(
          label: l10n.numbersWheel,
          value: formatNumber(circumference.value, decimals: 0),
          unit: 'mm',
          explained: circumference,
        ),
        const Divider(height: 32),
        _Stepper(
          label: l10n.numbersGearSpeed,
          value:
              '${formatNumber(units.speedFromKmh(_gearSpeedKmh))} '
              '${units.speedUnit}',
          onDecrease: _gearSpeedKmh > 3
              ? () => setState(() => _gearSpeedKmh -= 1)
              : null,
          onIncrease: _gearSpeedKmh < 70
              ? () => setState(() => _gearSpeedKmh += 1)
              : null,
        ),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [ConfidenceChip(table.confidence), WhyButton(table)],
        ),
        const SizedBox(height: 8),
        LabelValue(
          l10n.numbersGearColumnGear,
          l10n.numbersGearColumnCadence,
          style: theme.textTheme.labelLarge,
        ),
        const Divider(),
        for (final gear in gears)
          LabelValue(
            '${gear.chainring} × ${gear.cog}',
            '${cadenceAt(gear)} rpm',
          ),
        if (!drivetrain.cogsConfirmed)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(
              l10n.numbersCogsEstimated,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),
      ],
    );
  }

  Widget _climbCard(
    BuildContext context,
    MyNumbers numbers,
    DisplayUnits units, {
    required double riderMassKg,
    required int? ftpWatts,
  }) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final circumference = numbers.wheelCircumference;
    final drivetrain = numbers.drivetrain;

    final controls = [
      _Stepper(
        label: l10n.numbersClimbGrade,
        value: '${formatNumber(_gradePercent, decimals: 0)}%',
        onDecrease: _gradePercent > 1
            ? () => setState(() => _gradePercent -= 1)
            : null,
        onIncrease: _gradePercent < 20
            ? () => setState(() => _gradePercent += 1)
            : null,
      ),
      ChoiceField<Effort>(
        label: l10n.numbersClimbEffort,
        options: Effort.values,
        optionLabel: (effort) => switch (effort) {
          Effort.easy => l10n.effortEasy,
          Effort.steady => l10n.effortSteady,
          Effort.hard => l10n.effortHard,
        },
        value: _effort,
        onChanged: (effort) => setState(() => _effort = effort),
      ),
    ];

    if (circumference == null || drivetrain == null) {
      return SectionCard(
        title: l10n.numbersClimbTitle,
        children: [
          PromptRow(
            text: l10n.numbersClimbNeedsGears,
            actionLabel: l10n.todayAddBike,
            onPressed: () => context.push(AppRoutes.editBike),
          ),
        ],
      );
    }

    final prediction = predictClimb(
      power: climbingPowerW(
        effort: _effort,
        riderMassKg: riderMassKg,
        ftpWatts: ftpWatts,
      ),
      riderMassKg: riderMassKg,
      gradePercent: _gradePercent,
      chainrings: drivetrain.chainrings,
      cogs: drivetrain.cogs,
      cogsConfirmed: drivetrain.cogsConfirmed,
      circumference: circumference,
    );
    final climb = prediction.value;
    final best = climb.recommended;
    final grindWarning = l10n.numbersClimbGrind(
      climb.options.first.cadenceRpm.round(),
    );
    final grindFix = climb.willGrind
        ? l10n.numbersClimbGrindFix(
            climb.cogForComfort!,
            climb.chainringForComfort!,
          )
        : '';

    return SectionCard(
      title: l10n.numbersClimbTitle,
      children: [
        ...controls,
        const Divider(height: 32),
        _BigNumber(
          label: l10n.numbersClimbSpeed,
          value: formatNumber(units.speedFromKmh(climb.speedKmh)),
          unit: units.speedUnit,
          explained: prediction,
        ),
        const SizedBox(height: 12),
        Text(
          l10n.numbersClimbGear(
            '${best.gear.chainring} × ${best.gear.cog}',
            best.cadenceRpm.round(),
          ),
          style: theme.textTheme.titleMedium,
        ),
        if (climb.willGrind) ...[
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.warning_amber_rounded, color: theme.colorScheme.error),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '$grindWarning $grindFix',
                  style: theme.textTheme.bodyLarge,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _heatCard(BuildContext context, DisplayUnits units) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final index = heatIndexC(
      temperatureC: _temperatureC,
      humidityPercent: _humidityPercent,
    );
    final risk = heatRiskFor(index.value);
    final shownTemperature = formatNumber(
      units.temperatureFromC(_temperatureC),
      decimals: 0,
    );

    return SectionCard(
      title: l10n.numbersHeatTitle,
      children: [
        Text(
          l10n.numbersHeatNote,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        _Stepper(
          label: l10n.numbersHeatTemp,
          value: '$shownTemperature ${units.temperatureUnit}',
          onDecrease: _temperatureC > 15
              ? () => setState(() => _temperatureC -= 1)
              : null,
          onIncrease: _temperatureC < 45
              ? () => setState(() => _temperatureC += 1)
              : null,
        ),
        _Stepper(
          label: l10n.numbersHeatHumidity,
          value: '${formatNumber(_humidityPercent, decimals: 0)}%',
          onDecrease: _humidityPercent > 10
              ? () => setState(() => _humidityPercent -= 5)
              : null,
          onIncrease: _humidityPercent < 100
              ? () => setState(() => _humidityPercent += 5)
              : null,
        ),
        const Divider(height: 32),
        _BigNumber(
          label: l10n.numbersHeatIndex,
          value: formatNumber(units.temperatureFromC(index.value), decimals: 0),
          unit: units.temperatureUnit,
          explained: index,
        ),
        const SizedBox(height: 12),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: HeatBadge(risk),
        ),
        const SizedBox(height: 8),
        Text(l10n.heatAdvice(risk), style: theme.textTheme.bodyLarge),
      ],
    );
  }
}

/// A calculated value: label, large number with its unit, confidence chip and
/// "Why?" - the four things PROMPT.md 11 requires beside every number.
class _BigNumber extends StatelessWidget {
  const new({
    required this.label,
    required this.value,
    required this.unit,
    required this.explained,
  });

  final String label;
  final String value;
  final String unit;
  final Explained<Object?> explained;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: theme.textTheme.labelLarge?.copyWith(
            color: scheme.onSurfaceVariant,
          ),
        ),
        Text.rich(
          TextSpan(
            children: [
              TextSpan(
                text: value,
                style: theme.textTheme.displayMedium?.copyWith(
                  color: scheme.onSurface,
                ),
              ),
              TextSpan(
                text: ' $unit',
                style: theme.textTheme.headlineSmall?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            ConfidenceChip(explained.confidence),
            WhyButton(explained),
          ],
        ),
      ],
    );
  }
}

class _ZoneTable extends StatelessWidget {
  const new({required this.title, required this.unit, required this.zones});

  final String title;
  final String unit;
  final Explained<List<Zone>> zones;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);

    String range(Zone zone) {
      final upper = zone.upper;
      if (upper == null) return l10n.zoneAbove(zone.lower);
      if (zone.lower == 0) return l10n.zoneUpTo(upper);
      return l10n.zoneRange(zone.lower, upper);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: theme.textTheme.titleMedium),
        const SizedBox(height: 4),
        Text(
          l10n.formulaTitle(zones.formula),
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [ConfidenceChip(zones.confidence), WhyButton(zones)],
        ),
        const SizedBox(height: 8),
        for (final zone in zones.value)
          LabelValue(l10n.zoneLabel(zone.label), '${range(zone)} $unit'),
      ],
    );
  }
}

/// A value with minus and plus buttons. Chosen over a slider because each
/// button is a full 48 dp target that works with one thumb and a screen
/// reader, and a step is always exactly one unit.
class _Stepper extends StatelessWidget {
  const new({
    required this.label,
    required this.value,
    required this.onDecrease,
    required this.onIncrease,
  });

  final String label;
  final String value;
  final VoidCallback? onDecrease;
  final VoidCallback? onIncrease;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: theme.textTheme.titleMedium),
                Text(value, style: theme.textTheme.headlineSmall),
              ],
            ),
          ),
          IconButton.filledTonal(
            tooltip: l10n.stepperDecrease(label),
            onPressed: onDecrease,
            icon: const Icon(Icons.remove),
          ),
          const SizedBox(width: 8),
          IconButton.filledTonal(
            tooltip: l10n.stepperIncrease(label),
            onPressed: onIncrease,
            icon: const Icon(Icons.add),
          ),
        ],
      ),
    );
  }
}
