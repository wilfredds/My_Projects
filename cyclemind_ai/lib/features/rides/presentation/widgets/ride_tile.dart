import 'package:cyclemind_ai/app/theme/app_colors.dart';
import 'package:cyclemind_ai/features/bikes/presentation/controllers/bikes_providers.dart';
import 'package:cyclemind_ai/features/rides/domain/entities/ride.dart';
import 'package:cyclemind_ai/features/rides/presentation/controllers/rides_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

/// One ride in a list. Shared by the Dashboard's "Recent rides" and the full
/// rides screen; only the latter allows swipe-to-delete.
class RideTile extends ConsumerWidget {
  const RideTile({super.key, required this.ride, this.dismissible = false});

  final Ride ride;
  final bool dismissible;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final names = ref.watch(bikeNamesProvider);
    // Three distinct states, because "which bike was this?" is the question
    // the old UI could not answer at all.
    final bikeLabel = ride.bikeId == null
        ? 'No bike'
        : names[ride.bikeId] ?? 'Deleted bike';

    final tile = Card(
      margin: EdgeInsets.zero,
      child: ListTile(
        leading: const CircleAvatar(child: Icon(Icons.directions_bike)),
        title: Text(ride.title),
        subtitle: Text(
          '${DateFormat.MMMd().format(ride.startedAt)} · '
          '${ride.distanceKm.toStringAsFixed(1)} km · $bikeLabel',
        ),
        trailing: Text('${ride.elevationM.toStringAsFixed(0)} m',
            style: const TextStyle(color: AppColors.accent)),
      ),
    );

    if (!dismissible) return tile;

    return Dismissible(
      key: ValueKey(ride.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        decoration: BoxDecoration(
          color: AppColors.danger.withValues(alpha: 0.2),
          borderRadius: BorderRadius.circular(20),
        ),
        child: const Icon(Icons.delete, color: AppColors.danger),
      ),
      // confirmDismiss, not onDismissed: the old code fired the delete and
      // removed the row regardless of whether it succeeded. Here the delete is
      // awaited, failures are surfaced, and we always return false so the row
      // disappears only when the stream says it is actually gone.
      confirmDismiss: (_) async {
        final ok = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Delete this ride?'),
            content: Text(ride.odometerDeltaKm != null
                ? 'Its ${ride.distanceKm.toStringAsFixed(1)} km will be taken '
                    'back off the bike\'s odometer.'
                : 'This ride never added to an odometer, so nothing else '
                    'changes.'),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(ctx, false),
                  child: const Text('Cancel')),
              FilledButton(
                  onPressed: () => Navigator.pop(ctx, true),
                  child: const Text('Delete')),
            ],
          ),
        );
        if (ok != true) return false;

        final result = await ref.read(deleteRideProvider).call(ride);
        if (!context.mounted) return false;
        result.fold(
          (f) => ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(f.message))),
          (_) {},
        );
        return false;
      },
      child: tile,
    );
  }
}
