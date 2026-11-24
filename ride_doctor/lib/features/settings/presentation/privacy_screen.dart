import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/app/widgets/form_fields.dart';
import 'package:ride_doctor/core/app/environment.dart';
import 'package:ride_doctor/core/database/database_providers.dart';
import 'package:ride_doctor/features/onboarding/data/onboarding_providers.dart';
import 'package:ride_doctor/features/onboarding/domain/consent.dart';
import 'package:ride_doctor/features/onboarding/presentation/onboarding_text.dart';
import 'package:ride_doctor/features/settings/data/data_export.dart';
import 'package:ride_doctor/features/settings/presentation/settings_controller.dart';
import 'package:ride_doctor/l10n/l10n.dart';

/// The rider's data rights in one place: see and change what they agreed to,
/// take a copy of everything, or delete everything (PROMPT.md section 10).
class PrivacyScreen extends ConsumerWidget {
  const new({super.key});

  Future<void> _export(BuildContext context, WidgetRef ref) async {
    final database = await ref.read(appDatabaseProvider.future);
    final data = await exportAllData(
      database,
      exportedAt: ref.read(clockProvider)(),
    );
    final json = const JsonEncoder.withIndent('  ').convert(data);
    if (!context.mounted) return;
    await showDialog<void>(
      context: context,
      builder: (context) => _ExportDialog(json),
    );
  }

  Future<void> _deleteEverything(BuildContext context, WidgetRef ref) async {
    final l10n = context.l10n;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.privacyDeleteConfirmTitle),
        content: Text(l10n.privacyDeleteBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l10n.commonCancel),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
              foregroundColor: Theme.of(context).colorScheme.onError,
            ),
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(l10n.privacyDeleteConfirm),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    final database = await ref.read(appDatabaseProvider.future);
    await database.wipe();
    // Settings were just deleted too: go back to the defaults. The profile
    // disappearing sends the router to onboarding by itself.
    ref.invalidate(settingsControllerProvider);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final consents =
        ref.watch(currentConsentsProvider).value ?? const <ConsentKind, bool>{};

    return Scaffold(
      appBar: AppBar(title: Text(l10n.settingsPrivacy)),
      body: SafeArea(
        child: ScrollingColumn(
          children: [
            Padding(
              padding: const EdgeInsets.all(4),
              child: Text(
                ref.watch(appStorageProvider).persists
                    ? l10n.privacyStoredLocally
                    : l10n.webPreviewNotice,
                style: theme.textTheme.bodyLarge,
              ),
            ),
            const SizedBox(height: 8),
            Semantics(
              header: true,
              child: Text(
                l10n.privacyConsents,
                style: theme.textTheme.titleMedium?.copyWith(
                  color: theme.colorScheme.primary,
                ),
              ),
            ),
            // Health-data consent is shown as a fact, not a switch: it cannot
            // be turned off while the data it covers is still stored.
            // Withdrawing it is "Delete everything", below.
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(
                consents[ConsentKind.healthData] ?? false
                    ? Icons.check_circle_outline
                    : Icons.radio_button_unchecked,
                color: theme.colorScheme.primary,
              ),
              title: Text(l10n.consentTitle(ConsentKind.healthData)),
              subtitle: Text(
                '${l10n.privacyHealthGranted}. ${l10n.privacyHealthNote}',
              ),
            ),
            for (final kind in const [
              ConsentKind.location,
              ConsentKind.notifications,
            ])
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(l10n.consentTitle(kind)),
                subtitle: Text(l10n.consentBody(kind)),
                value: consents[kind] ?? false,
                onChanged: (granted) async {
                  final repository = await ref.read(
                    consentRepositoryProvider.future,
                  );
                  await repository.record(kind, granted: granted);
                },
              ),
            const Divider(height: 32),
            Text(l10n.privacyExport, style: theme.textTheme.titleMedium),
            const SizedBox(height: 4),
            Text(l10n.privacyExportBody),
            const SizedBox(height: 8),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: FilledButton.tonal(
                onPressed: () => _export(context, ref),
                child: Text(l10n.privacyExport),
              ),
            ),
            const Divider(height: 32),
            Text(l10n.privacyDelete, style: theme.textTheme.titleMedium),
            const SizedBox(height: 4),
            Text(l10n.privacyDeleteBody),
            const SizedBox(height: 8),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  foregroundColor: theme.colorScheme.error,
                ),
                onPressed: () => _deleteEverything(context, ref),
                child: Text(l10n.privacyDelete),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ExportDialog extends StatelessWidget {
  const new(this.json);

  final String json;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AlertDialog(
      title: Text(l10n.privacyExport),
      content: SizedBox(
        width: double.maxFinite,
        child: SingleChildScrollView(
          child: SelectableText(
            json,
            style: const TextStyle(fontFamily: 'monospace', fontSize: 13),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(l10n.commonClose),
        ),
        FilledButton(
          onPressed: () async {
            final messenger = ScaffoldMessenger.of(context);
            await Clipboard.setData(ClipboardData(text: json));
            messenger.showSnackBar(
              SnackBar(content: Text(l10n.privacyExportCopied)),
            );
          },
          child: Text(l10n.privacyExportCopy),
        ),
      ],
    );
  }
}
