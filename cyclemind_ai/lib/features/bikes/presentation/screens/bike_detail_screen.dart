import 'package:cyclemind_ai/app/theme/app_colors.dart';
import 'package:cyclemind_ai/core/widgets/stat_card.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
import 'package:cyclemind_ai/features/bikes/presentation/controllers/bikes_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

/// Bike detail: specs, component wear bars, and add-component flow.
///
/// Reads the live bike from [bikesStreamProvider] (falling back to the passed
/// [bike]) so wear bars update immediately after edits.
class BikeDetailScreen extends ConsumerWidget {
  const BikeDetailScreen({super.key, required this.bike});
  final Bike bike;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bikes = ref.watch(bikesStreamProvider).valueOrNull ?? const [];
    final current = bikes.firstWhere((b) => b.id == bike.id, orElse: () => bike);

    return Scaffold(
      appBar: AppBar(title: Text(current.name)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _addComponent(context, ref, current),
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
                )),
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

  Future<void> _addComponent(
      BuildContext context, WidgetRef ref, Bike current) async {
    final type = TextEditingController(text: 'Chain');
    final brand = TextEditingController();
    final lifespan = TextEditingController(text: '3000');

    final added = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add component'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
                controller: type,
                decoration: const InputDecoration(labelText: 'Type')),
            const SizedBox(height: 8),
            TextField(
                controller: brand,
                decoration: const InputDecoration(labelText: 'Brand')),
            const SizedBox(height: 8),
            TextField(
                controller: lifespan,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Lifespan (km)')),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Add')),
        ],
      ),
    );

    if (added != true) return;
    final components = [
      ...current.components,
      BikeComponent(
        id: const Uuid().v4(),
        type: type.text.trim(),
        brand: brand.text.trim(),
        // "Installed at today's odometer reading" — correct as written. It
        // only looked broken while the odometer was frozen.
        installedAtKm: current.totalMileageKm,
        lifespanKm: double.tryParse(lifespan.text) ?? 3000,
      ),
    ];
    // setComponents, NOT updateBike: the old call wrote the whole document
    // from a possibly-stale snapshot, so adding a component silently rolled
    // the odometer back to whatever this screen last read.
    final result =
        await ref.read(bikesRepositoryProvider).setComponents(current.id, components);
    if (!context.mounted) return;
    result.fold(
      (f) => ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(f.message))),
      (_) {},
    );
  }
}

class _ComponentTile extends StatelessWidget {
  const _ComponentTile({required this.component, required this.bikeTotalKm});
  final BikeComponent component;
  final double bikeTotalKm;

  @override
  Widget build(BuildContext context) {
    final wear = component.wearFraction(bikeTotalKm);
    final color = wear >= 1.0
        ? AppColors.danger
        : wear >= 0.8
            ? AppColors.warning
            : AppColors.success;
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(16),
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
            Text(
              '${component.usedKm(bikeTotalKm).toStringAsFixed(0)} / '
              '${component.lifespanKm.toStringAsFixed(0)} km',
              style: const TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
        ),
      ),
    );
  }
}
