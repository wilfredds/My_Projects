import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/app/widgets/form_fields.dart';
import 'package:ride_doctor/core/app/environment.dart';
import 'package:ride_doctor/core/units/display_units.dart';
import 'package:ride_doctor/features/profile/data/profile_providers.dart';
import 'package:ride_doctor/features/profile/domain/number_rule.dart';
import 'package:ride_doctor/features/profile/domain/rider_profile.dart';
import 'package:ride_doctor/features/profile/presentation/profile_text.dart';
import 'package:ride_doctor/features/settings/domain/app_settings.dart';
import 'package:ride_doctor/features/settings/presentation/settings_controller.dart';
import 'package:ride_doctor/l10n/l10n.dart';

/// Edits everything about the rider, including the optional numbers that make
/// the calculations more personal.
class EditRiderScreen extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<EditRiderScreen> createState() => _EditRiderScreenState();
}

class _EditRiderScreenState extends ConsumerState<EditRiderScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _birthYear = TextEditingController();
  final _height = TextEditingController();
  final _weight = TextEditingController();
  final _inseam = TextEditingController();
  final _restingHr = TextEditingController();
  final _maxHr = TextEditingController();
  final _lthr = TextEditingController();
  final _ftp = TextEditingController();
  final _yearsRiding = TextEditingController();
  final _ridesPerWeek = TextEditingController();
  final _typicalRide = TextEditingController();
  final _hoursPerWeek = TextEditingController();

  RidingGoal? _goal;
  Sex? _sex;
  var _loaded = false;

  DisplayUnits get _units => DisplayUnits(
    metric:
        ref.read(settingsControllerProvider).unitSystem == UnitSystem.metric,
  );

  /// Copies the stored profile into the fields, once.
  void _load(RiderProfile profile) {
    if (_loaded) return;
    _loaded = true;
    final units = _units;
    String optional(num? value) => value == null ? '' : formatNumber(value);
    _name.text = profile.displayName;
    _birthYear.text = '${profile.birthYear}';
    _height.text = formatNumber(units.heightFromCm(profile.heightCm));
    _weight.text = formatNumber(units.weightFromKg(profile.weightKg));
    _inseam.text = profile.inseamMm == null
        ? ''
        : formatNumber(units.lengthFromMm(profile.inseamMm!));
    _restingHr.text = optional(profile.restingHrBpm);
    _maxHr.text = optional(profile.maxHrBpm);
    _lthr.text = optional(profile.lthrBpm);
    _ftp.text = optional(profile.ftpWatts);
    _yearsRiding.text = formatNumber(profile.yearsRiding);
    _ridesPerWeek.text = '${profile.ridesPerWeek}';
    _typicalRide.text = '${profile.typicalRideMinutes}';
    _hoursPerWeek.text = formatNumber(profile.hoursPerWeek);
    _goal = profile.goal;
    _sex = profile.sex;
  }

  @override
  void dispose() {
    for (final controller in [
      _name,
      _birthYear,
      _height,
      _weight,
      _inseam,
      _restingHr,
      _maxHr,
      _lthr,
      _ftp,
      _yearsRiding,
      _ridesPerWeek,
      _typicalRide,
      _hoursPerWeek,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final l10n = context.l10n;
    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);
    final units = _units;
    int? whole(TextEditingController c) => NumberRule.parse(c.text)?.round();

    final repository = await ref.read(riderRepositoryProvider.future);
    final inseam = NumberRule.parse(_inseam.text);
    await repository.saveProfile(
      RiderProfile(
        displayName: _name.text.trim(),
        birthYear: whole(_birthYear)!,
        heightCm: units.heightToCm(NumberRule.parse(_height.text)!),
        weightKg: units.weightToKg(NumberRule.parse(_weight.text)!),
        yearsRiding: NumberRule.parse(_yearsRiding.text)!,
        ridesPerWeek: whole(_ridesPerWeek)!,
        typicalRideMinutes: whole(_typicalRide)!,
        hoursPerWeek: NumberRule.parse(_hoursPerWeek.text)!,
        goal: _goal!,
        sex: _sex,
        inseamMm: inseam == null ? null : units.lengthToMm(inseam),
        restingHrBpm: whole(_restingHr),
        maxHrBpm: whole(_maxHr),
        lthrBpm: whole(_lthr),
        ftpWatts: whole(_ftp),
      ),
    );
    messenger.showSnackBar(SnackBar(content: Text(l10n.commonSaved)));
    router.pop();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final profile = ref.watch(riderProfileProvider).value;
    final units = DisplayUnits(
      metric:
          ref.watch(settingsControllerProvider.select((s) => s.unitSystem)) ==
          UnitSystem.metric,
    );
    if (profile != null) _load(profile);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.profileEditRider)),
      body: SafeArea(
        child: profile == null
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
                        validator: (text) {
                          final name = text?.trim() ?? '';
                          if (name.isEmpty) return l10n.errorRequired;
                          if (name.length > ProfileLimits.maxNameLength) {
                            return l10n.errorNameTooLong(
                              ProfileLimits.maxNameLength,
                            );
                          }
                          return null;
                        },
                        decoration: InputDecoration(
                          labelText: l10n.fieldName,
                          border: const OutlineInputBorder(),
                        ),
                      ),
                    ),
                    AppNumberField(
                      controller: _birthYear,
                      label: l10n.fieldBirthYear,
                      rule: ProfileLimits.birthYear(
                        currentYear: ref.watch(clockProvider)().year,
                      ),
                    ),
                    AppNumberField(
                      controller: _height,
                      label: l10n.fieldHeight,
                      unit: units.heightUnit,
                      rule: ProfileLimits.heightCm,
                      toMetric: units.heightToCm,
                      fromMetric: units.heightFromCm,
                    ),
                    AppNumberField(
                      controller: _weight,
                      label: l10n.fieldWeight,
                      why: l10n.fieldWeightWhy,
                      unit: units.weightUnit,
                      rule: ProfileLimits.weightKg,
                      toMetric: units.weightToKg,
                      fromMetric: units.weightFromKg,
                    ),
                    ChoiceField<RidingGoal>(
                      label: l10n.fieldGoal,
                      options: RidingGoal.values,
                      optionLabel: l10n.goalLabel,
                      value: _goal,
                      onChanged: (goal) => setState(() => _goal = goal),
                    ),
                    ChoiceField<Sex>(
                      label: '${l10n.fieldSex} (${l10n.commonOptional})',
                      why: l10n.fieldSexWhy,
                      options: Sex.values,
                      optionLabel: l10n.sexLabel,
                      value: _sex,
                      onChanged: (sex) => setState(() => _sex = sex),
                    ),
                    AppNumberField(
                      controller: _inseam,
                      label: l10n.fieldInseam,
                      why: l10n.fieldInseamWhy,
                      unit: units.lengthUnit,
                      rule: ProfileLimits.inseamMm,
                      required: false,
                      toMetric: units.lengthToMm,
                      fromMetric: units.lengthFromMm,
                    ),
                    AppNumberField(
                      controller: _restingHr,
                      label: l10n.fieldRestingHr,
                      why: l10n.fieldRestingHrWhy,
                      unit: 'bpm',
                      rule: ProfileLimits.restingHrBpm,
                      required: false,
                    ),
                    AppNumberField(
                      controller: _maxHr,
                      label: l10n.fieldMaxHr,
                      why: l10n.fieldMaxHrWhy,
                      unit: 'bpm',
                      rule: ProfileLimits.maxHrBpm,
                      required: false,
                    ),
                    AppNumberField(
                      controller: _lthr,
                      label: l10n.fieldLthr,
                      why: l10n.fieldLthrWhy,
                      unit: 'bpm',
                      rule: ProfileLimits.lthrBpm,
                      required: false,
                    ),
                    AppNumberField(
                      controller: _ftp,
                      label: l10n.fieldFtp,
                      why: l10n.fieldFtpWhy,
                      unit: 'W',
                      rule: ProfileLimits.ftpWatts,
                      required: false,
                    ),
                    AppNumberField(
                      controller: _yearsRiding,
                      label: l10n.fieldYearsRiding,
                      unit: l10n.unitYears,
                      rule: ProfileLimits.yearsRiding,
                    ),
                    AppNumberField(
                      controller: _ridesPerWeek,
                      label: l10n.fieldRidesPerWeek,
                      rule: ProfileLimits.ridesPerWeek,
                    ),
                    AppNumberField(
                      controller: _typicalRide,
                      label: l10n.fieldTypicalRide,
                      unit: l10n.unitMinutes,
                      rule: ProfileLimits.typicalRideMinutes,
                    ),
                    AppNumberField(
                      controller: _hoursPerWeek,
                      label: l10n.fieldHoursPerWeek,
                      unit: l10n.unitHours,
                      rule: ProfileLimits.hoursPerWeek,
                    ),
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
