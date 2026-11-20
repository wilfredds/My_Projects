import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/app/l10n/app_locales.dart';
import 'package:ride_doctor/app/router/app_router.dart';
import 'package:ride_doctor/app/theme/app_palette.dart';
import 'package:ride_doctor/app/theme/app_theme.dart';
import 'package:ride_doctor/features/settings/domain/app_settings.dart';
import 'package:ride_doctor/features/settings/presentation/settings_controller.dart';
import 'package:ride_doctor/l10n/generated/app_localizations.dart';

class RideDoctorApp extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsControllerProvider);
    final palette = ref.watch(palettePreviewProvider);
    final languageCode = settings.languageCode;

    return MaterialApp.router(
      onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
      routerConfig: ref.watch(appRouterProvider),
      theme: AppTheme.build(palette, Brightness.light),
      darkTheme: AppTheme.build(palette, Brightness.dark),
      themeMode: switch (settings.themeMode) {
        AppThemeMode.system => ThemeMode.system,
        AppThemeMode.light => ThemeMode.light,
        AppThemeMode.dark => ThemeMode.dark,
      },
      // null means "follow the device", resolved by resolveAppLocale below.
      locale: languageCode == null ? null : Locale(languageCode),
      supportedLocales: AppLocales.supported,
      localeListResolutionCallback: (deviceLocales, _) =>
          AppLocales.resolve(deviceLocales),
      localizationsDelegates: const [
        AppLocalizations.delegate,
        // The Material/Cupertino/Widgets delegates from material_ui. We do not
        // use the generated `AppLocalizations.localizationsDelegates` list
        // because it still pulls the deprecated flutter_localizations
        // Material delegate (see docs/DECISIONS.md, ADR-0002).
        ...GlobalMaterialLocalizations.delegates,
      ],
    );
  }
}
