import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/app/router/app_router.dart';
import 'package:ride_doctor/app/widgets/form_fields.dart';
import 'package:ride_doctor/core/app/environment.dart';
import 'package:ride_doctor/features/race_prep/data/race_providers.dart';
import 'package:ride_doctor/features/race_prep/domain/countdown.dart';
import 'package:ride_doctor/features/race_prep/domain/race_checklist.dart';
import 'package:ride_doctor/features/race_prep/domain/race_day_timeline.dart';
import 'package:ride_doctor/features/race_prep/domain/race_debrief.dart';
import 'package:ride_doctor/features/race_prep/domain/race_event.dart';
import 'package:ride_doctor/features/race_prep/domain/skill_cards.dart';
import 'package:ride_doctor/features/race_prep/presentation/race_text.dart';
import 'package:ride_doctor/l10n/l10n.dart';

/// Everything for one race: the countdown mode it is in, the race-day
/// timeline, the checklist, the skills for that kind of race, and - once it
/// is over - the debrief.
class RaceDetailScreen extends ConsumerWidget {
  const new({required this.raceId, super.key});

  final String raceId;

  Future<void> _delete(BuildContext context, WidgetRef ref) async {
    final l10n = context.l10n;
    final router = GoRouter.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.raceDeleteConfirmTitle),
        content: Text(l10n.raceDeleteConfirmBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l10n.commonCancel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(l10n.raceDelete),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    final repository = await ref.read(raceRepositoryProvider.future);
    router.pop();
    await repository.deleteRace(raceId);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final race = ref.watch(raceProvider(raceId)).value;
    if (race == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    final now = ref.watch(clockProvider)();
    final mode = countdownMode(now: now, raceStart: race.startsAt);
    final debrief = ref.watch(raceDebriefsProvider).value?[race.id];
    final startsAt = l10n.raceStartsAt(
      MaterialLocalizations.of(context).formatFullDate(race.startsAt),
      clockTime(race.startsAt),
    );

    final plan = _ModeCard(race: race, mode: mode, now: now);
    final timeline = _TimelineCard(race: race);
    final checklist = _ChecklistCard(raceId: race.id);
    final skills = _SkillsCard(type: race.type);

    return Scaffold(
      appBar: AppBar(
        title: Text(race.name),
        actions: [
          IconButton(
            tooltip: l10n.raceEdit,
            icon: const Icon(Icons.edit_outlined),
            onPressed: () => context.push(AppRoutes.raceEdit(race.id)),
          ),
          IconButton(
            tooltip: l10n.raceDelete,
            icon: const Icon(Icons.delete_outline),
            onPressed: () => _delete(context, ref),
          ),
        ],
      ),
      body: SafeArea(
        child: ScrollingColumn(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 4, 4, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.raceWhen(
                      daysUntil(now: now, raceStart: race.startsAt),
                    ),
                    style: theme.textTheme.headlineLarge,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    [
                      l10n.raceTypeLabel(race.type),
                      startsAt,
                      ?race.location,
                    ].join(' · '),
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            if (mode == CountdownMode.raceOver || debrief != null) ...[
              _DebriefCard(race: race, debrief: debrief),
              const SizedBox(height: 16),
            ],
            // The order follows what matters now: with under two weeks to
            // go the timeline and checklist lead; earlier, the plan does.
            ...switch (mode) {
              CountdownMode.raceDay ||
              CountdownMode.raceWeek => [plan, timeline, checklist, skills],
              CountdownMode.longBuild || CountdownMode.compressedBuild => [
                plan,
                skills,
                checklist,
                timeline,
              ],
              CountdownMode.raceOver => [plan, skills],
            }.expand((card) => [card, const SizedBox(height: 16)]),
          ],
        ),
      ),
    );
  }
}

class _ModeCard extends StatelessWidget {
  const new({required this.race, required this.mode, required this.now});

  final RaceEvent race;
  final CountdownMode mode;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final material = MaterialLocalizations.of(context);
    final phases = planPhases(
      now: now,
      raceStart: race.startsAt,
      addedAt: race.addedAt,
    );

    return SectionCard(
      title: l10n.modeTitle(mode),
      children: [
        Text(l10n.modeBody(mode), style: theme.textTheme.bodyLarge),
        for (final block in phases) ...[
          const SizedBox(height: 16),
          Text(l10n.phaseName(block.phase), style: theme.textTheme.titleMedium),
          Text(
            l10n.phaseRange(
              material.formatMediumDate(block.firstDay),
              material.formatMediumDate(block.lastDay),
            ),
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 4),
          Text(l10n.phaseBody(block.phase), style: theme.textTheme.bodyLarge),
          if (block.phase == PlanPhase.taper)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                l10n.phaseTaperSource,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ),
        ],
      ],
    );
  }
}

class _TimelineCard extends StatelessWidget {
  const new({required this.race});

  final RaceEvent race;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final items = raceDayTimeline(
      raceStart: race.startsAt,
      travelMinutes: race.travelMinutes,
      reconAllowed: race.reconAllowed,
    );
    return SectionCard(
      title: l10n.raceTimelineTitle,
      children: [
        for (final item in items)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  clockTime(item.time),
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: theme.colorScheme.primary,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Text(
                    l10n.timelineStepLabel(item.step),
                    style: item.step == TimelineStep.raceStart
                        ? theme.textTheme.titleMedium
                        : theme.textTheme.bodyLarge,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _ChecklistCard extends ConsumerWidget {
  const new({required this.raceId});

  final String raceId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final checked =
        ref.watch(checkedItemsProvider(raceId)).value ??
        const <ChecklistItem>{};

    return SectionCard(
      title: l10n.raceChecklistTitle,
      children: [
        Text(
          l10n.checklistProgress(checked.length, ChecklistItem.values.length),
          style: theme.textTheme.titleMedium,
        ),
        for (final group in ChecklistGroup.values) ...[
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Semantics(
              header: true,
              child: Text(
                l10n.checklistGroupLabel(group),
                style: theme.textTheme.titleMedium?.copyWith(
                  color: theme.colorScheme.primary,
                ),
              ),
            ),
          ),
          for (final item in ChecklistItem.inGroup(group))
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              title: Text(l10n.checklistItemLabel(item)),
              value: checked.contains(item),
              onChanged: (value) async {
                final repository = await ref.read(
                  raceRepositoryProvider.future,
                );
                await repository.setChecked(
                  raceId,
                  item,
                  checked: value ?? false,
                );
              },
            ),
        ],
        const SizedBox(height: 8),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: OutlinedButton(
            onPressed: checked.isEmpty
                ? null
                : () async {
                    final repository = await ref.read(
                      raceRepositoryProvider.future,
                    );
                    await repository.resetChecklist(raceId);
                  },
            child: Text(l10n.checklistReset),
          ),
        ),
      ],
    );
  }
}

class _SkillsCard extends StatelessWidget {
  const new({required this.type});

  final RaceType type;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    return SectionCard(
      title: l10n.raceTacticsTitle,
      children: [
        for (final card in skillCardsFor(type))
          Builder(
            builder: (context) {
              final (title, body, drill) = l10n.skillCardText(card);
              return ExpansionTile(
                tilePadding: EdgeInsets.zero,
                childrenPadding: const EdgeInsets.only(bottom: 12),
                expandedCrossAxisAlignment: CrossAxisAlignment.start,
                expandedAlignment: Alignment.topLeft,
                shape: const Border(),
                collapsedShape: const Border(),
                title: Text(title, style: theme.textTheme.titleMedium),
                children: [
                  Text(body, style: theme.textTheme.bodyLarge),
                  const SizedBox(height: 12),
                  Text(
                    l10n.skillDrillLabel,
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: theme.colorScheme.primary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(drill, style: theme.textTheme.bodyLarge),
                ],
              );
            },
          ),
      ],
    );
  }
}

class _DebriefCard extends StatelessWidget {
  const new({required this.race, required this.debrief});

  final RaceEvent race;
  final RaceDebrief? debrief;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final debrief = this.debrief;

    void open() => context.push(AppRoutes.raceDebrief(race.id));

    if (debrief == null) {
      return SectionCard(
        title: l10n.raceDebriefTitle,
        children: [
          PromptRow(
            text: l10n.modeRaceOverBody,
            actionLabel: l10n.debriefStart,
            onPressed: open,
          ),
        ],
      );
    }

    final placing = debrief.placing;
    final fieldSize = debrief.fieldSize;
    final wouldChange = debrief.wouldChange;
    String list(Iterable<String> labels) => labels.join(', ');

    return SectionCard(
      title: l10n.raceDebriefTitle,
      children: [
        Text(
          placing != null && fieldSize != null
              ? l10n.raceResult(placing, fieldSize)
              : debrief.finished
              ? l10n.debriefSummaryFinished
              : l10n.debriefSummaryDidNotFinish,
          style: theme.textTheme.headlineSmall,
        ),
        if (debrief.hasRedFlag)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: scheme.errorContainer,
                borderRadius: const BorderRadius.all(Radius.circular(16)),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.medical_services_outlined,
                      color: scheme.onErrorContainer,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l10n.debriefRedFlagTitle,
                            style: theme.textTheme.titleMedium?.copyWith(
                              color: scheme.onErrorContainer,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            l10n.debriefRedFlagBody,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: scheme.onErrorContainer,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        LabelValue(l10n.debriefDropped, l10n.droppedLabel(debrief.droppedWhen)),
        if (debrief.struggles.isNotEmpty)
          LabelValue(
            l10n.debriefStruggles,
            list(debrief.struggles.map(l10n.struggleLabel)),
          ),
        if (debrief.symptoms.isNotEmpty)
          LabelValue(
            l10n.debriefSymptoms,
            list(debrief.symptoms.map(l10n.symptomLabel)),
          ),
        if (wouldChange != null)
          LabelValue(l10n.debriefWouldChange, wouldChange),
        const SizedBox(height: 8),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: FilledButton.tonal(
            onPressed: open,
            child: Text(l10n.debriefEdit),
          ),
        ),
      ],
    );
  }
}
