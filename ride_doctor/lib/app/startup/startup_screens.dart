import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/core/database/database_providers.dart';
import 'package:ride_doctor/l10n/l10n.dart';

/// Shown for the moment it takes to open the encrypted database.
class StartingScreen extends StatelessWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(),
          const SizedBox(height: 16),
          Text(context.l10n.startingMessage),
        ],
      ),
    ),
  );
}

/// Shown when the database cannot be opened - most likely because the key in
/// the phone's secure storage is gone. The data cannot be recovered without
/// that key (that is the point of encrypting it), so the honest options are
/// to try again or to start over.
class StartupErrorScreen extends ConsumerWidget {
  const new({super.key});

  Future<void> _reset(WidgetRef ref) async {
    await ref.read(appStorageProvider).destroy();
    ref.invalidate(appDatabaseProvider);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 48),
              Icon(Icons.lock_reset, size: 56, color: theme.colorScheme.error),
              const SizedBox(height: 24),
              Text(
                l10n.startupErrorTitle,
                style: theme.textTheme.headlineLarge,
              ),
              const SizedBox(height: 12),
              Text(l10n.startupErrorBody, style: theme.textTheme.bodyLarge),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: () => ref.invalidate(appDatabaseProvider),
                child: Text(l10n.commonRetry),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                style: OutlinedButton.styleFrom(
                  foregroundColor: theme.colorScheme.error,
                ),
                onPressed: () => unawaited(_reset(ref)),
                child: Text(l10n.startupErrorReset),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
