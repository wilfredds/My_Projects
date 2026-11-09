import 'package:cyclemind_ai/app/router/app_router.dart';
import 'package:cyclemind_ai/app/theme/app_theme.dart';
import 'package:cyclemind_ai/core/constants/app_constants.dart';
import 'package:cyclemind_ai/core/widgets/sync_error_listener.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Root widget. Wires the router and the Material 3 light/dark themes.
class CycleMindApp extends ConsumerWidget {
  const CycleMindApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(goRouterProvider);
    return MaterialApp.router(
      title: AppConstants.appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.dark, // dark-first premium feel
      routerConfig: router,
      // Below the root ScaffoldMessenger, so a change that fails to sync
      // after being saved offline is reported on whatever screen is open.
      builder: (context, child) =>
          SyncErrorListener(child: child ?? const SizedBox.shrink()),
    );
  }
}
