import 'package:cyclemind_ai/core/widgets/empty_state.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/maintenance_log.dart';
import 'package:cyclemind_ai/features/bikes/presentation/controllers/bikes_providers.dart';
import 'package:cyclemind_ai/features/bikes/presentation/widgets/status_color.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Garage: lists all of the user's bikes with a quick wear indicator.
class BikesScreen extends ConsumerWidget {
  const BikesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bikesAsync = ref.watch(bikesStreamProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('My bikes')),
      floatingActionButton: FloatingActionButton.extended(
        // No hero animation: see dashboard_screen.dart.
        heroTag: null,
        onPressed: () => context.push('/bikes/new'),
        icon: const Icon(Icons.add),
        label: const Text('Add bike'),
      ),
      body: bikesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (bikes) {
          if (bikes.isEmpty) {
            return EmptyState(
              icon: Icons.pedal_bike,
              title: 'No bikes yet',
              message: 'Add a bike to track components and maintenance.',
              action: FilledButton(
                onPressed: () => context.push('/bikes/new'),
                child: const Text('Add bike'),
              ),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: bikes.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (_, i) => _BikeCard(bike: bikes[i]),
          );
        },
      ),
    );
  }
}

class _BikeCard extends StatelessWidget {
  const _BikeCard({required this.bike});
  final Bike bike;

  @override
  Widget build(BuildContext context) {
    final worstWear = bike.components.isEmpty
        ? 0.0
        : bike.components
            .map((c) => c.wearFraction(bike.totalMileageKm))
            .reduce((a, b) => a > b ? a : b);
    final color = statusColor(statusForWear(worstWear));

    return Card(
      child: ListTile(
        contentPadding: const EdgeInsets.all(16),
        leading: CircleAvatar(
          radius: 26,
          backgroundColor: color.withValues(alpha: 0.18),
          child: Icon(Icons.pedal_bike, color: color),
        ),
        title: Text(bike.name,
            style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(
          '${bike.groupset}\n${bike.totalMileageKm.toStringAsFixed(0)} km · '
          '${bike.components.length} components',
        ),
        isThreeLine: true,
        trailing: const Icon(Icons.chevron_right),
        onTap: () => context.push('/bikes/detail', extra: bike),
      ),
    );
  }
}
