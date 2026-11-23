import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/app/router/app_router.dart';
import 'package:ride_doctor/app/widgets/form_fields.dart';
import 'package:ride_doctor/core/units/display_units.dart';
import 'package:ride_doctor/features/profile/data/profile_providers.dart';
import 'package:ride_doctor/features/profile/domain/bike.dart';
import 'package:ride_doctor/features/profile/presentation/profile_text.dart';
import 'package:ride_doctor/features/settings/domain/app_settings.dart';
import 'package:ride_doctor/features/settings/presentation/settings_controller.dart';
import 'package:ride_doctor/l10n/l10n.dart';

/// What the app knows about the rider and their bike, with a way to edit each
/// and to say which sensors they own.
class ProfileScreen extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final profile = ref.watch(riderProfileProvider).value;
    final bike = ref.watch(bikeProvider).value;
    final sensors = ref.watch(sensorsProvider).value ?? const <SensorKind>{};
    final units = DisplayUnits(
      metric:
          ref.watch(settingsControllerProvider.select((s) => s.unitSystem)) ==
          UnitSystem.metric,
    );

    String orNotSet(String? text) => text ?? l10n.profileNotSet;
    String? length(double? mm) => mm == null
        ? null
        : '${formatNumber(units.lengthFromMm(mm))} ${units.lengthUnit}';

    final drivetrain = bike?.drivetrain;
    final tyre = bike?.beadSeatDiameterMm == null || bike?.tyreWidthMm == null
        ? null
        : '${bike!.tyreWidthMm}-${bike.beadSeatDiameterMm}';

    return Scaffold(
      appBar: AppBar(title: Text(l10n.navProfile)),
      body: SafeArea(
        child: profile == null
            ? const Center(child: CircularProgressIndicator())
            : ScrollingColumn(
                children: [
                  SectionCard(
                    title: l10n.profileRiderSection,
                    children: [
                      LabelValue(l10n.profileName, profile.displayName),
                      LabelValue(l10n.fieldBirthYear, '${profile.birthYear}'),
                      LabelValue(
                        l10n.fieldHeight,
                        '${formatNumber(units.heightFromCm(profile.heightCm))} '
                        '${units.heightUnit}',
                      ),
                      LabelValue(
                        l10n.fieldWeight,
                        '${formatNumber(units.weightFromKg(profile.weightKg))} '
                        '${units.weightUnit}',
                      ),
                      LabelValue(l10n.fieldGoal, l10n.goalLabel(profile.goal)),
                      LabelValue(
                        l10n.fieldInseam,
                        orNotSet(length(profile.inseamMm)),
                      ),
                      LabelValue(
                        l10n.fieldRestingHr,
                        orNotSet(
                          profile.restingHrBpm == null
                              ? null
                              : '${profile.restingHrBpm} bpm',
                        ),
                      ),
                      LabelValue(
                        l10n.fieldMaxHr,
                        orNotSet(
                          profile.maxHrBpm == null
                              ? null
                              : '${profile.maxHrBpm} bpm',
                        ),
                      ),
                      LabelValue(
                        l10n.fieldLthr,
                        orNotSet(
                          profile.lthrBpm == null
                              ? null
                              : '${profile.lthrBpm} bpm',
                        ),
                      ),
                      LabelValue(
                        l10n.fieldFtp,
                        orNotSet(
                          profile.ftpWatts == null
                              ? null
                              : '${profile.ftpWatts} W',
                        ),
                      ),
                      const SizedBox(height: 8),
                      FilledButton.tonal(
                        onPressed: () => context.push(AppRoutes.editRider),
                        child: Text(l10n.profileEditRider),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  SectionCard(
                    title: l10n.profileBikeSection,
                    children: [
                      if (bike == null)
                        Text(l10n.profileNoBike)
                      else ...[
                        LabelValue(
                          l10n.profileBikeType,
                          l10n.bikeTypeLabel(bike.type),
                        ),
                        LabelValue(l10n.fieldTyreSize, orNotSet(tyre)),
                        LabelValue(
                          l10n.fieldCrank,
                          orNotSet(
                            bike.crankLengthMm == null
                                ? null
                                : '${formatNumber(bike.crankLengthMm!)} mm',
                          ),
                        ),
                        LabelValue(
                          l10n.fieldPedals,
                          orNotSet(
                            bike.pedals == null
                                ? null
                                : l10n.pedalLabel(bike.pedals!),
                          ),
                        ),
                        LabelValue(
                          l10n.fieldSaddleHeight,
                          orNotSet(length(bike.saddleHeightMm)),
                        ),
                        LabelValue(
                          l10n.fieldChainrings,
                          orNotSet(drivetrain?.chainrings.join(', ')),
                        ),
                        LabelValue(
                          l10n.fieldCogs,
                          orNotSet(drivetrain?.cogs.join(', ')),
                        ),
                      ],
                      const SizedBox(height: 8),
                      FilledButton.tonal(
                        onPressed: () => context.push(AppRoutes.editBike),
                        child: Text(l10n.profileEditBike),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  SectionCard(
                    title: l10n.profileSensorsSection,
                    children: [
                      Text(l10n.profileSensorsHint),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        children: [
                          for (final kind in SensorKind.values)
                            FilterChip(
                              label: Text(l10n.sensorLabel(kind)),
                              selected: sensors.contains(kind),
                              onSelected: (selected) async {
                                final garage = await ref.read(
                                  garageRepositoryProvider.future,
                                );
                                await garage.setSensors({
                                  ...sensors.where((other) => other != kind),
                                  if (selected) kind,
                                });
                              },
                            ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
      ),
    );
  }
}
