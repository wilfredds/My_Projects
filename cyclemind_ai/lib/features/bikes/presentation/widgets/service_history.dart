import 'package:cyclemind_ai/features/bikes/domain/entities/maintenance_log.dart';
import 'package:cyclemind_ai/features/bikes/presentation/controllers/bikes_providers.dart';
import 'package:cyclemind_ai/features/bikes/presentation/widgets/status_color.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

/// One bike's service history, newest first.
///
/// Entries are append-only (firestore.rules denies update and delete), which
/// is what makes this history worth trusting. It is the seed of the bike's
/// passport.
class ServiceHistory extends ConsumerWidget {
  const ServiceHistory({super.key, required this.bikeId});

  final String bikeId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ref.watch(maintenanceLogsProvider(bikeId)).when(
          // Inline, never full-screen: the wear tiles above are already
          // usable while history loads.
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Center(
              child: SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          ),
          // In live mode the likeliest cause is the composite index not being
          // deployed yet; the Firestore SDK logs a link to create it.
          error: (_, __) => const _Note('Couldn\'t load service history.'),
          data: (logs) => logs.isEmpty
              ? const _Note('No services recorded yet. When you fit a new '
                  'part, tap Mark replaced on it.')
              : Column(children: [for (final l in logs) _LogTile(log: l)]),
        );
  }
}

class _LogTile extends StatelessWidget {
  const _LogTile({required this.log});

  final MaintenanceLog log;

  @override
  Widget build(BuildContext context) {
    final small = Theme.of(context).textTheme.bodySmall;
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.build_circle_outlined, color: statusColor(log.status)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${log.component} replaced',
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text(
                    '${DateFormat.yMMMd().format(log.serviceDate)} · '
                    'at ${log.mileageAtService.toStringAsFixed(0)} km · '
                    '${_phrase(log.status)}',
                    style: small,
                  ),
                  if (log.notes.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(log.notes, style: small),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// [MaintenanceLog.status] is the status of the part that was REMOVED.
String _phrase(MaintenanceStatus s) => switch (s) {
      MaintenanceStatus.ok => 'replaced early',
      MaintenanceStatus.dueSoon => 'was due soon',
      MaintenanceStatus.overdue => 'was overdue',
    };

class _Note extends StatelessWidget {
  const _Note(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Text(text,
            style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant)),
      );
}
