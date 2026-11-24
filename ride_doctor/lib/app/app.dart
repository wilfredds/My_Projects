import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/app/l10n/app_locales.dart';
import 'package:ride_doctor/app/router/app_router.dart';
import 'package:ride_doctor/app/theme/app_theme.dart';
import 'package:ride_doctor/core/database/database_providers.dart';
import 'package:ride_doctor/features/settings/domain/app_settings.dart';
import 'package:ride_doctor/features/settings/presentation/settings_controller.dart';
import 'package:ride_doctor/l10n/generated/app_localizations.dart';

class RideDoctorApp extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsControllerProvider);
    final languageCode = settings.languageCode;

    return MaterialApp.router(
      // The debug ribbon sits on top of the app-bar action in the corner.
      debugShowCheckedModeBanner: false,
      onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
      routerConfig: ref.watch(appRouterProvider),
      theme: AppTheme.build(Brightness.light),
      darkTheme: AppTheme.build(Brightness.dark),
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
      // In the web preview, say on every screen that nothing is kept.
      builder: (context, child) => ref.watch(appStorageProvider).persists
          ? child!
          : _PreviewFrame(child: child!),
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

/// A thin strip above the whole app in the web preview.
class _PreviewFrame extends StatelessWidget {
  const new({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Column(
      children: [
        Material(
          color: scheme.tertiaryContainer,
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: SizedBox(
                width: double.infinity,
                child: Text(
                  AppLocalizations.of(context).webPreviewBanner,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: scheme.onTertiaryContainer,
                  ),
                ),
              ),
            ),
          ),
        ),
        // The strip already covers the status-bar inset, so the screens below
        // must not add it a second time.
        Expanded(
          child: MediaQuery.removePadding(
            context: context,
            removeTop: true,
            child: child,
          ),
        ),
      ],
    );
  }
}
