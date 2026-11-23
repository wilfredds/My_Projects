import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/app/router/app_router.dart';
import 'package:ride_doctor/core/app/environment.dart';
import 'package:ride_doctor/features/race_prep/data/race_providers.dart';
import 'package:ride_doctor/features/race_prep/domain/countdown.dart';
import 'package:ride_doctor/features/race_prep/domain/race_debrief.dart';
import 'package:ride_doctor/features/race_prep/domain/race_event.dart';
import 'package:ride_doctor/features/race_prep/presentation/race_text.dart';
import 'package:ride_doctor/l10n/l10n.dart';

/// The rider's races: upcoming ones with their countdown, then past ones with
/// their result - the history the debriefs build up.
class RacesScreen extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final now = ref.watch(clockProvider)();
    final races = ref.watch(racesProvider).value ?? const <RaceEvent>[];
    final debriefs =
        ref.watch(raceDebriefsProvider).value ?? const <String, RaceDebrief>{};

    bool isOver(RaceEvent race) => race.startsAt.isBefore(now);
    final upcoming = races.where((race) => !isOver(race)).toList();
    // Most recent past race first.
    final past = races.where(isOver).toList().reversed.toList();

    String countdown(RaceEvent race) {
      final days = daysUntil(now: now, raceStart: race.startsAt);
      final mode = countdownMode(now: now, raceStart: race.startsAt);
      return '${l10n.raceWhen(days)} · ${l10n.modeTitle(mode)}';
    }

    Widget heading(String text) => Padding(
      padding: const EdgeInsets.fromLTRB(4, 16, 4, 8),
      child: Semantics(
        header: true,
        child: Text(
          text,
          style: theme.textTheme.titleMedium?.copyWith(
            color: theme.colorScheme.primary,
          ),
        ),
      ),
    );

    return Scaffold(
      appBar: AppBar(title: Text(l10n.navRaces)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(AppRoutes.raceForm),
        icon: const Icon(Icons.add),
        label: Text(l10n.racesAdd),
      ),
      body: SafeArea(
        child: races.isEmpty
            ? SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 32),
                    Icon(
                      Icons.flag_outlined,
                      size: 56,
                      color: theme.colorScheme.primary,
                    ),
                    const SizedBox(height: 24),
                    Text(
                      l10n.racesEmptyTitle,
                      style: theme.textTheme.headlineLarge,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      l10n.racesEmptyBody,
                      style: theme.textTheme.bodyLarge?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              )
            : ListView(
                // Room at the bottom so the last row clears the button.
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 96),
                children: [
                  if (upcoming.isNotEmpty) heading(l10n.racesUpcoming),
                  for (final race in upcoming)
                    _RaceTile(race: race, subtitle: countdown(race)),
                  if (past.isNotEmpty) heading(l10n.racesPast),
                  for (final race in past)
                    _RaceTile(
                      race: race,
                      subtitle: switch (debriefs[race.id]) {
                        null => l10n.raceNoDebrief,
                        RaceDebrief(:final placing?, :final fieldSize?) =>
                          l10n.raceResult(placing, fieldSize),
                        RaceDebrief(finished: true) =>
                          l10n.debriefSummaryFinished,
                        _ => l10n.debriefSummaryDidNotFinish,
                      },
                    ),
                ],
              ),
      ),
    );
  }
}

class _RaceTile extends StatelessWidget {
  const new({required this.race, required this.subtitle});

  final RaceEvent race;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final date = MaterialLocalizations.of(context)
        .formatMediumDate(race.startsAt);
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        title: Text(race.name),
        subtitle: Text('${l10n.raceTypeLabel(race.type)} · $date\n$subtitle'),
        isThreeLine: true,
        trailing: const Icon(Icons.chevron_right),
        onTap: () => context.push(AppRoutes.raceDetail(race.id)),
      ),
    );
  }
}
