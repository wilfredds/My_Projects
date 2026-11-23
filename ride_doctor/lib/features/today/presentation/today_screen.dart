import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/app/router/app_router.dart';
import 'package:ride_doctor/app/widgets/confidence_chip.dart';
import 'package:ride_doctor/app/widgets/form_fields.dart';
import 'package:ride_doctor/app/widgets/why_sheet.dart';
import 'package:ride_doctor/core/app/environment.dart';
import 'package:ride_doctor/features/calculators/presentation/my_numbers_provider.dart';
import 'package:ride_doctor/features/onboarding/data/onboarding_providers.dart';
import 'package:ride_doctor/features/onboarding/presentation/onboarding_screen.dart';
import 'package:ride_doctor/features/profile/data/profile_providers.dart';
import 'package:ride_doctor/features/race_prep/data/race_providers.dart';
import 'package:ride_doctor/features/race_prep/domain/countdown.dart';
import 'package:ride_doctor/features/race_prep/domain/race_event.dart';
import 'package:ride_doctor/features/race_prep/presentation/race_text.dart';
import 'package:ride_doctor/l10n/l10n.dart';

/// The home screen. For now it greets the rider, surfaces their first useful
/// number, and points at the next thing to add. The session card, heat badge
/// and race countdown join it in Phases 2 and 3.
class TodayScreen extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final profile = ref.watch(riderProfileProvider).value;
    final numbers = ref.watch(myNumbersProvider);
    final readiness = ref.watch(latestReadinessProvider).value;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.todayTitle),
        actions: [
          IconButton(
            // The tooltip doubles as the screen-reader label for this
            // icon-only button.
            tooltip: l10n.settingsTitle,
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => context.push(AppRoutes.settings),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            if (profile != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 8, 4, 16),
                child: Text(
                  l10n.todayGreeting(profile.displayName),
                  style: theme.textTheme.headlineLarge,
                ),
              ),
            if (readiness?.anyYes ?? false) const ReadinessAdvice(),
            const _RaceCard(),
            if (numbers != null) ...[
              SectionCard(
                title: l10n.todayNumbersTitle,
                children: [
                  Text(
                    l10n.todayNumbersBody(numbers.maxHr.value),
                    style: theme.textTheme.bodyLarge,
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      ConfidenceChip(numbers.maxHr.confidence),
                      WhyButton(numbers.maxHr),
                    ],
                  ),
                  const SizedBox(height: 8),
                  FilledButton(
                    onPressed: () => context.go(AppRoutes.numbers),
                    child: Text(l10n.todayOpenNumbers),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (!numbers.canCalculateGearing) ...[
                SectionCard(
                  title: l10n.todayBikePromptTitle,
                  children: [
                    PromptRow(
                      text: l10n.todayBikePromptBody,
                      actionLabel: l10n.todayAddBike,
                      onPressed: () => context.push(AppRoutes.editBike),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
              ],
            ],
            SectionCard(
              title: l10n.todayComingTitle,
              children: [
                Text(
                  l10n.todayEmptyBody,
                  style: theme.textTheme.bodyLarge?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// The race countdown on the home screen: the next race coming up, or - when
/// the last one has just been ridden and not yet debriefed - a nudge to
/// record it while the memory is fresh. Shows nothing if there is neither.
class _RaceCard extends ConsumerWidget {
  const new();

  /// How long after a race the debrief nudge stays on the home screen.
  static const _debriefWindow = Duration(days: 14);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final now = ref.watch(clockProvider)();
    final races = ref.watch(racesProvider).value ?? const <RaceEvent>[];
    final debriefs = ref.watch(raceDebriefsProvider).value ?? const {};

    final next = races
        .where((race) => !race.startsAt.isBefore(now))
        .firstOrNull;
    final awaitingDebrief = races.reversed
        .where(
          (race) =>
              race.startsAt.isBefore(now) &&
              now.difference(race.startsAt) < _debriefWindow &&
              !debriefs.containsKey(race.id),
        )
        .firstOrNull;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (awaitingDebrief != null) ...[
          SectionCard(
            title: l10n.raceDebriefTitle,
            children: [
              PromptRow(
                text: l10n.todayDebriefPrompt(awaitingDebrief.name),
                actionLabel: l10n.debriefStart,
                onPressed: () =>
                    context.push(AppRoutes.raceDebrief(awaitingDebrief.id)),
              ),
            ],
          ),
          const SizedBox(height: 16),
        ],
        if (next != null) ...[
          SectionCard(
            title: next.name,
            children: [
              Text(
                l10n.raceWhen(daysUntil(now: now, raceStart: next.startsAt)),
                style: theme.textTheme.displaySmall,
              ),
              const SizedBox(height: 4),
              Text(
                l10n.modeTitle(
                  countdownMode(now: now, raceStart: next.startsAt),
                ),
                style: theme.textTheme.titleMedium?.copyWith(
                  color: theme.colorScheme.primary,
                ),
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () => context.push(AppRoutes.raceDetail(next.id)),
                child: Text(l10n.todayRaceOpen),
              ),
            ],
          ),
          const SizedBox(height: 16),
        ],
      ],
    );
  }
}
