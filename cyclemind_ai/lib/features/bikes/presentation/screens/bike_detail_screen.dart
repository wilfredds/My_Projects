import 'package:cyclemind_ai/app/theme/app_colors.dart';
import 'package:cyclemind_ai/core/constants/app_constants.dart';
import 'package:cyclemind_ai/core/widgets/stat_card.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
// For statusForWear / MaintenanceStatus. Top-level functions and extensions
// are not transitively visible, so the defining library is imported directly.
import 'package:cyclemind_ai/features/bikes/domain/entities/maintenance_log.dart';
import 'package:cyclemind_ai/features/bikes/presentation/controllers/bikes_providers.dart';
import 'package:cyclemind_ai/features/bikes/presentation/widgets/add_component_dialog.dart';
import 'package:cyclemind_ai/features/bikes/presentation/widgets/replace_component_dialog.dart';
import 'package:cyclemind_ai/features/bikes/presentation/widgets/service_history.dart';
import 'package:cyclemind_ai/features/bikes/presentation/widgets/status_color.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Bike detail: specs, component wear, "Mark replaced", and service history.
///
/// Reads the live bike from [bikesStreamProvider] (falling back to the passed
/// [bike] for display only) so wear bars update immediately after edits.
/// Writes never use that fallback; they always start from the live stream.
class BikeDetailScreen extends ConsumerWidget {
  const BikeDetailScreen({super.key, required this.bike});
  final Bike bike;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bikes = ref.watch(bikesStreamProvider).valueOrNull ?? const [];
    final current = bikeById(bikes, bike.id) ?? bike;

    return Scaffold(
      appBar: AppBar(title: Text(current.name)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _addComponent(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('Component'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Expanded(
                  child: StatCard(
                      icon: Icons.speed,
                      value: '${current.totalMileageKm.toStringAsFixed(0)} km',
                      label: 'Odometer')),
              const SizedBox(width: 12),
              Expanded(
                  child: StatCard(
                      icon: Icons.settings,
                      value: '${current.components.length}',
                      label: 'Components',
                      color: AppColors.accent)),
            ],
          ),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _spec('Frame', current.frame),
                  _spec('Groupset', current.groupset),
                  _spec('Tires', current.tires),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          const SectionHeader(title: 'Component wear'),
          if (current.components.isEmpty)
            const Text('No components tracked yet. Add one to get reminders.')
          else
            ...current.components.map((c) => _ComponentTile(
                  component: c,
                  bikeTotalKm: current.totalMileageKm,
                  onReplace: () => markReplaced(context,
                      bikeId: current.id, componentId: c.id),
                )),
          const SizedBox(height: 20),
          const SectionHeader(title: 'Service history'),
          ServiceHistory(bikeId: current.id),
          // Clearance so the FAB never covers the last entry.
          const SizedBox(height: 80),
        ],
      ),
    );
  }

  Widget _spec(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            SizedBox(width: 90, child: Text(k, style: const TextStyle(color: Colors.grey))),
            Expanded(child: Text(v.isEmpty ? '—' : v)),
          ],
        ),
      );

  Bike? _liveBike(WidgetRef ref) =>
      bikeById(ref.read(bikesStreamProvider).valueOrNull ?? const [], bike.id);

  Future<void> _addComponent(BuildContext context, WidgetRef ref) async {
    void say(String m) => ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(m)));

    final live = _liveBike(ref);
    if (live == null) {
      say('This bike is no longer available.');
      return;
    }
    // Mirrors `d.components.size() <= 60` in firestore.rules: say so here
    // rather than letting the write fail with an opaque permission error.
    if (live.components.length >= AppConstants.maxComponentsPerBike) {
      say('A bike can track at most '
          '${AppConstants.maxComponentsPerBike} components.');
      return;
    }

    final added = await showDialog<BikeComponent>(
      context: context,
      builder: (_) => AddComponentDialog(odometerKm: live.totalMileageKm),
    );
    if (added == null || !context.mounted) return;

    // Re-read AFTER the dialog. The components array is written whole, so it
    // must start from the freshest copy, never the snapshot this screen was
    // opened with.
    final fresh = _liveBike(ref);
    if (fresh == null) {
      say('This bike is no longer available.');
      return;
    }

    // setComponents, NOT a whole-document write: the old updateBike call
    // wrote from a possibly-stale snapshot, so adding a component silently
    // rolled the odometer back to whatever this screen last read.
    final result = await ref
        .read(bikesRepositoryProvider)
        .setComponents(fresh.id, [...fresh.components, added]);
    if (!context.mounted) return;
    result.fold((f) => say(f.message), (_) {});
  }
}

class _ComponentTile extends StatelessWidget {
  const _ComponentTile({
    required this.component,
    required this.bikeTotalKm,
    required this.onReplace,
  });

  final BikeComponent component;
  final double bikeTotalKm;
  final VoidCallback onReplace;

  @override
  Widget build(BuildContext context) {
    final wear = component.wearFraction(bikeTotalKm);
    final status = statusForWear(wear);
    final color = statusColor(status);
    const replaceIcon = Icon(Icons.autorenew, size: 18);
    const replaceLabel = Text('Mark replaced');

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text('${component.type} · ${component.brand}',
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                ),
                Text('${(wear * 100).clamp(0, 999).round()}%',
                    style: TextStyle(color: color, fontWeight: FontWeight.w700)),
              ],
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                value: wear.clamp(0, 1).toDouble(),
                minHeight: 8,
                color: color,
                backgroundColor:
                    Theme.of(context).colorScheme.surfaceContainerHighest,
              ),
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${component.usedKm(bikeTotalKm).toStringAsFixed(0)} / '
                    '${component.lifespanKm.toStringAsFixed(0)} km',
                    style: const TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                ),
                // Always available: replacing early (after a crash, say) is
                // legitimate. It's just louder when the part is due.
                if (status == MaintenanceStatus.ok)
                  TextButton.icon(
                    onPressed: onReplace,
                    icon: replaceIcon,
                    label: replaceLabel,
                  )
                else
                  FilledButton.tonalIcon(
                    onPressed: onReplace,
                    // The theme gives FilledButtons `Size.fromHeight(52)`, an
                    // INFINITE minimum width, for full-width form buttons. In
                    // this Row that swallowed the km text and pushed the
                    // button off screen, exactly when the part was due.
                    style: FilledButton.styleFrom(minimumSize: const Size(0, 40)),
                    icon: replaceIcon,
                    label: replaceLabel,
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
