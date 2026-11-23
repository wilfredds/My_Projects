import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/app/router/app_router.dart';
import 'package:ride_doctor/features/settings/domain/app_settings.dart';
import 'package:ride_doctor/features/settings/presentation/settings_controller.dart';
import 'package:ride_doctor/l10n/l10n.dart';

/// The language options as the screen shows them. "Follow the device" is a
/// real choice here, where the stored setting represents it as null.
enum _LanguageChoice {
  device(null),
  english('en'),
  filipino('fil');

  new(this.code);

  final String? code;

  static _LanguageChoice fromCode(String? code) =>
      values.firstWhere((choice) => choice.code == code, orElse: () => device);
}

class SettingsScreen extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final settings = ref.watch(settingsControllerProvider);
    final controller = ref.read(settingsControllerProvider.notifier);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.settingsTitle)),
      body: SafeArea(
        child: ListView(
          children: [
            _SectionHeader(l10n.settingsAppearance),
            // Radio rows rather than a segmented button: each row is a full
            // width 48 dp+ target, and long translated labels wrap instead of
            // being squeezed at large text sizes.
            RadioGroup<AppThemeMode>(
              groupValue: settings.themeMode,
              onChanged: (mode) {
                if (mode != null) unawaited(controller.setThemeMode(mode));
              },
              child: Column(
                children: [
                  RadioListTile(
                    value: AppThemeMode.system,
                    title: Text(l10n.themeSystem),
                  ),
                  RadioListTile(
                    value: AppThemeMode.light,
                    title: Text(l10n.themeLight),
                  ),
                  RadioListTile(
                    value: AppThemeMode.dark,
                    title: Text(l10n.themeDark),
                  ),
                ],
              ),
            ),
            _SectionHeader(l10n.settingsLanguage),
            RadioGroup<_LanguageChoice>(
              groupValue: _LanguageChoice.fromCode(settings.languageCode),
              onChanged: (choice) {
                if (choice != null) {
                  unawaited(controller.setLanguageCode(choice.code));
                }
              },
              child: Column(
                children: [
                  RadioListTile(
                    value: _LanguageChoice.device,
                    title: Text(l10n.languageDevice),
                  ),
                  RadioListTile(
                    value: _LanguageChoice.english,
                    title: Text(l10n.languageEnglish),
                  ),
                  RadioListTile(
                    value: _LanguageChoice.filipino,
                    title: Text(l10n.languageFilipino),
                  ),
                ],
              ),
            ),
            _SectionHeader(l10n.settingsUnits),
            RadioGroup<UnitSystem>(
              groupValue: settings.unitSystem,
              onChanged: (system) {
                if (system != null) unawaited(controller.setUnitSystem(system));
              },
              child: Column(
                children: [
                  RadioListTile(
                    value: UnitSystem.metric,
                    title: Text(l10n.unitsMetric),
                  ),
                  RadioListTile(
                    value: UnitSystem.imperial,
                    title: Text(l10n.unitsImperial),
                  ),
                ],
              ),
            ),
            const Divider(height: 32),
            ListTile(
              leading: const Icon(Icons.lock_outline),
              title: Text(l10n.settingsPrivacy),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push(AppRoutes.privacy),
            ),
            _SectionHeader(l10n.settingsDeveloper),
            ListTile(
              leading: const Icon(Icons.palette_outlined),
              title: Text(l10n.designPreviewTitle),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push(AppRoutes.designPreview),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const new(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
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
  }
}
