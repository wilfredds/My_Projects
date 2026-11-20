import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/app/router/app_router.dart';
import 'package:ride_doctor/l10n/l10n.dart';

/// The home screen. In Phase 0 it is an honest empty state; later phases add
/// the session card, heat badge, race countdown and "Something hurts?" entry.
class TodayScreen extends StatelessWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.todayTitle),
        actions: [
          IconButton(
            // The tooltip doubles as the screen-reader label for this
            // icon-only button.
            tooltip: l10n.settingsTitle,
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => context.go(AppRoutes.settings),
          ),
        ],
      ),
      body: SafeArea(
        // Scrollable so the text still fits at 200% text scale on a small
        // phone instead of overflowing.
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 48),
              Icon(
                Icons.directions_bike,
                size: 56,
                color: theme.colorScheme.primary,
              ),
              const SizedBox(height: 24),
              Text(l10n.todayEmptyTitle, style: theme.textTheme.headlineLarge),
              const SizedBox(height: 12),
              Text(
                l10n.todayEmptyBody,
                style: theme.textTheme.bodyLarge?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
