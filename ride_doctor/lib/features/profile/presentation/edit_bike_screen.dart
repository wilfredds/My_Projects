import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/app/widgets/form_fields.dart';
import 'package:ride_doctor/core/app/environment.dart';
import 'package:ride_doctor/core/science/gearing.dart';
import 'package:ride_doctor/core/units/display_units.dart';
import 'package:ride_doctor/core/units/units.dart';
import 'package:ride_doctor/features/profile/data/profile_providers.dart';
import 'package:ride_doctor/features/profile/domain/bike.dart';
import 'package:ride_doctor/features/profile/domain/number_rule.dart';
import 'package:ride_doctor/features/profile/presentation/profile_text.dart';
import 'package:ride_doctor/features/settings/domain/app_settings.dart';
import 'package:ride_doctor/features/settings/presentation/settings_controller.dart';
import 'package:ride_doctor/l10n/l10n.dart';

/// Edits the bike: tyre size, fit measurements and gears. Everything except
/// the bike type is optional - each piece unlocks a calculation.
class EditBikeScreen extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<EditBikeScreen> createState() => _EditBikeScreenState();
}

class _EditBikeScreenState extends ConsumerState<EditBikeScreen> {
  final _formKey = GlobalKey<FormState>();
  final _rimDiameter = TextEditingController();
  final _tyreWidth = TextEditingController();
  final _rollOut = TextEditingController();
  final _crank = TextEditingController();
  final _saddleHeight = TextEditingController();
  final _tyrePressure = TextEditingController();
  final _chainrings = TextEditingController();
  final _smallestCog = TextEditingController();
  final _largestCog = TextEditingController();
  final _speeds = TextEditingController();
  final _cogs = TextEditingController();

  BikeType _type = BikeType.road;
  PedalType? _pedals;

  /// The chosen preset, or null for "other size" (typed in by hand).
  TyreSize? _tyrePreset;
  var _customTyre = false;
  var _cogsConfirmed = false;
  String? _cassetteError;
  String? _bikeId;
  var _loaded = false;

  DisplayUnits get _units => DisplayUnits(
    metric:
        ref.read(settingsControllerProvider).unitSystem == UnitSystem.metric,
  );

  void _load(Bike? bike) {
    if (_loaded) return;
    _loaded = true;
    if (bike == null) return;
    final units = _units;
    String optional(num? value) => value == null ? '' : formatNumber(value);

    _bikeId = bike.id;
    _type = bike.type;
    _pedals = bike.pedals;
    final bsd = bike.beadSeatDiameterMm;
    final width = bike.tyreWidthMm;
    if (bsd != null && width != null) {
      _tyrePreset = commonTyreSizes
          .where((s) => s.beadSeatDiameterMm == bsd && s.widthMm == width)
          .firstOrNull;
      _customTyre = _tyrePreset == null;
      _rimDiameter.text = '$bsd';
      _tyreWidth.text = '$width';
    }
    _rollOut.text = optional(bike.rollOutMm);
    _crank.text = optional(bike.crankLengthMm);
    _saddleHeight.text = bike.saddleHeightMm == null
        ? ''
        : formatNumber(units.lengthFromMm(bike.saddleHeightMm!));
    _tyrePressure.text = bike.tyrePressureKpa == null
        ? ''
        : formatNumber(
            Units.barToPsi(bike.tyrePressureKpa! / 100),
            decimals: 0,
          );
    final drivetrain = bike.drivetrain;
    if (drivetrain != null) {
      _chainrings.text = drivetrain.chainrings.join(', ');
      _cogs.text = drivetrain.cogs.join(', ');
      _cogsConfirmed = drivetrain.cogsConfirmed;
      if (drivetrain.cogs.isNotEmpty) {
        _smallestCog.text = '${drivetrain.cogs.first}';
        _largestCog.text = '${drivetrain.cogs.last}';
        _speeds.text = '${drivetrain.cogs.length}';
      }
    }
  }

  @override
  void dispose() {
    for (final controller in [
      _rimDiameter,
      _tyreWidth,
      _rollOut,
      _crank,
      _saddleHeight,
      _tyrePressure,
      _chainrings,
      _smallestCog,
      _largestCog,
      _speeds,
      _cogs,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  /// Fills the cog list from "smallest, largest, how many" - what a rider can
  /// read off the cassette's box - and marks it as unconfirmed.
  void _estimateCogs() {
    final l10n = context.l10n;
    final smallest = int.tryParse(_smallestCog.text.trim());
    final largest = int.tryParse(_largestCog.text.trim());
    final speeds = int.tryParse(_speeds.text.trim());
    if (smallest == null ||
        largest == null ||
        speeds == null ||
        !cassetteFits(smallest: smallest, largest: largest, speeds: speeds)) {
      setState(() => _cassetteError = l10n.errorCassetteRange);
      return;
    }
    final cogs = estimateCogs(
      smallest: smallest,
      largest: largest,
      speeds: speeds,
    );
    setState(() {
      _cogs.text = cogs.join(', ');
      _cogsConfirmed = false;
      _cassetteError = null;
    });
  }

  String? _teethError(String? text, NumberRule rule, {required bool needed}) {
    final l10n = context.l10n;
    if (text == null || text.trim().isEmpty) {
      return needed ? l10n.errorRequired : null;
    }
    return parseTeeth(text, rule) == null
        ? l10n.errorTeeth(rule.min.round(), rule.max.round())
        : null;
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final l10n = context.l10n;
    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);
    final units = _units;
    double? number(TextEditingController c) => NumberRule.parse(c.text);

    final preset = _tyrePreset;
    final saddle = number(_saddleHeight);
    final pressurePsi = number(_tyrePressure);
    final chainrings = parseTeeth(
      _chainrings.text,
      ProfileLimits.chainringTeeth,
    );
    final cogs = parseTeeth(_cogs.text, ProfileLimits.cogTeeth);

    final garage = await ref.read(garageRepositoryProvider.future);
    await garage.saveBike(
      Bike(
        id: _bikeId ?? ref.read(idGeneratorProvider)(),
        type: _type,
        beadSeatDiameterMm: _customTyre
            ? number(_rimDiameter)?.round()
            : preset?.beadSeatDiameterMm,
        tyreWidthMm: _customTyre
            ? number(_tyreWidth)?.round()
            : preset?.widthMm,
        rollOutMm: number(_rollOut),
        crankLengthMm: number(_crank),
        pedals: _pedals,
        saddleHeightMm: saddle == null ? null : units.lengthToMm(saddle),
        tyrePressureKpa: pressurePsi == null
            ? null
            : Units.psiToBar(pressurePsi) * 100,
        drivetrain: chainrings == null || cogs == null
            ? null
            : Drivetrain(
                chainrings: chainrings,
                cogs: cogs,
                cogsConfirmed: _cogsConfirmed,
              ),
      ),
    );
    messenger.showSnackBar(SnackBar(content: Text(l10n.commonSaved)));
    router.pop();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final bikeAsync = ref.watch(bikeProvider);
    final units = DisplayUnits(
      metric:
          ref.watch(settingsControllerProvider.select((s) => s.unitSystem)) ==
          UnitSystem.metric,
    );
    if (bikeAsync.hasValue) _load(bikeAsync.value);

    // Chainrings and cogs only mean something together: if either is filled
    // in, the other becomes required.
    final wantsDrivetrain =
        _chainrings.text.trim().isNotEmpty || _cogs.text.trim().isNotEmpty;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.profileEditBike)),
      body: SafeArea(
        child: !bikeAsync.hasValue
            ? const Center(child: CircularProgressIndicator())
            : Form(
                key: _formKey,
                child: ScrollingColumn(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                  children: [
                    ChoiceField<BikeType>(
                      label: l10n.fieldBikeType,
                      options: BikeType.values,
                      optionLabel: l10n.bikeTypeLabel,
                      value: _type,
                      onChanged: (type) => setState(() => _type = type),
                    ),
                    ChoiceField<String>(
                      label: l10n.fieldTyreSize,
                      why: l10n.fieldTyreSizeWhy,
                      options: [
                        for (final size in commonTyreSizes) size.label,
                        l10n.tyreSizeOther,
                      ],
                      optionLabel: (label) => label,
                      value: _customTyre
                          ? l10n.tyreSizeOther
                          : _tyrePreset?.label,
                      onChanged: (label) => setState(() {
                        _tyrePreset = commonTyreSizes
                            .where((size) => size.label == label)
                            .firstOrNull;
                        _customTyre = _tyrePreset == null;
                      }),
                    ),
                    if (_customTyre) ...[
                      AppNumberField(
                        controller: _rimDiameter,
                        label: l10n.fieldRimDiameter,
                        unit: 'mm',
                        rule: ProfileLimits.beadSeatDiameterMm,
                      ),
                      AppNumberField(
                        controller: _tyreWidth,
                        label: l10n.fieldTyreWidth,
                        unit: 'mm',
                        rule: ProfileLimits.tyreWidthMm,
                      ),
                    ],
                    AppNumberField(
                      controller: _rollOut,
                      label: l10n.fieldRollOut,
                      why: l10n.fieldRollOutWhy,
                      unit: 'mm',
                      rule: ProfileLimits.rollOutMm,
                      required: false,
                    ),
                    AppNumberField(
                      controller: _crank,
                      label: l10n.fieldCrank,
                      why: l10n.fieldCrankWhy,
                      unit: 'mm',
                      rule: ProfileLimits.crankLengthMm,
                      required: false,
                    ),
                    ChoiceField<PedalType>(
                      label: l10n.fieldPedals,
                      options: PedalType.values,
                      optionLabel: l10n.pedalLabel,
                      value: _pedals,
                      onChanged: (pedals) => setState(() => _pedals = pedals),
                    ),
                    AppNumberField(
                      controller: _saddleHeight,
                      label: l10n.fieldSaddleHeight,
                      why: l10n.fieldSaddleHeightWhy,
                      unit: units.lengthUnit,
                      rule: ProfileLimits.saddleHeightMm,
                      required: false,
                      toMetric: units.lengthToMm,
                      fromMetric: units.lengthFromMm,
                    ),
                    AppNumberField(
                      controller: _tyrePressure,
                      label: l10n.fieldTyrePressure,
                      unit: 'psi',
                      rule: ProfileLimits.tyrePressureKpa,
                      required: false,
                      toMetric: (psi) => Units.psiToBar(psi) * 100,
                      fromMetric: (kpa) => Units.barToPsi(kpa / 100),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: TextFormField(
                        controller: _chainrings,
                        keyboardType: TextInputType.datetime,
                        onChanged: (_) => setState(() {}),
                        validator: (text) => _teethError(
                          text,
                          ProfileLimits.chainringTeeth,
                          needed: wantsDrivetrain,
                        ),
                        decoration: InputDecoration(
                          labelText:
                              '${l10n.fieldChainrings} '
                              '(${l10n.commonOptional})',
                          helperText: l10n.fieldChainringsWhy,
                          helperMaxLines: 3,
                          errorMaxLines: 4,
                          border: const OutlineInputBorder(),
                        ),
                      ),
                    ),
                    Text(
                      l10n.fieldCassetteWhy,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                    AppNumberField(
                      controller: _smallestCog,
                      label: l10n.fieldCassetteSmallest,
                      unit: l10n.unitTeeth,
                      rule: ProfileLimits.cogTeeth,
                      required: false,
                    ),
                    AppNumberField(
                      controller: _largestCog,
                      label: l10n.fieldCassetteLargest,
                      unit: l10n.unitTeeth,
                      rule: ProfileLimits.cogTeeth,
                      required: false,
                    ),
                    AppNumberField(
                      controller: _speeds,
                      label: l10n.fieldCassetteSpeeds,
                      rule: ProfileLimits.cassetteSpeeds,
                      required: false,
                    ),
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: FilledButton.tonal(
                        onPressed: _estimateCogs,
                        child: Text(l10n.estimateCogsButton),
                      ),
                    ),
                    if (_cassetteError != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          _cassetteError!,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: theme.colorScheme.error,
                          ),
                        ),
                      ),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: TextFormField(
                        controller: _cogs,
                        keyboardType: TextInputType.datetime,
                        onChanged: (_) => setState(() {}),
                        validator: (text) => _teethError(
                          text,
                          ProfileLimits.cogTeeth,
                          needed: wantsDrivetrain,
                        ),
                        decoration: InputDecoration(
                          labelText:
                              '${l10n.fieldCogs} (${l10n.commonOptional})',
                          helperText: l10n.fieldCogsWhy,
                          helperMaxLines: 3,
                          errorMaxLines: 4,
                          border: const OutlineInputBorder(),
                        ),
                      ),
                    ),
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      controlAffinity: ListTileControlAffinity.leading,
                      title: Text(l10n.fieldCogsConfirmed),
                      value: _cogsConfirmed,
                      onChanged: (checked) =>
                          setState(() => _cogsConfirmed = checked ?? false),
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
