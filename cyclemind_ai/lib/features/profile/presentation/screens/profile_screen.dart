import 'package:cyclemind_ai/app/theme/app_colors.dart';
import 'package:cyclemind_ai/core/constants/app_constants.dart';
import 'package:cyclemind_ai/features/auth/domain/entities/app_user.dart';
import 'package:cyclemind_ai/features/auth/presentation/controllers/auth_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Profile + preferences: rider level, goals, app preferences, and sign out.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authStateProvider).valueOrNull;
    if (user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Center(
            child: Column(
              children: [
                CircleAvatar(
                  radius: 40,
                  backgroundColor: AppColors.brand.withValues(alpha: 0.18),
                  child: Text(
                    user.profile.displayName.isNotEmpty
                        ? user.profile.displayName[0].toUpperCase()
                        : '?',
                    style: const TextStyle(
                        fontSize: 28, fontWeight: FontWeight.w700),
                  ),
                ),
                const SizedBox(height: 12),
                Text(user.profile.displayName,
                    style: Theme.of(context).textTheme.titleLarge),
                Text(user.email,
                    style: TextStyle(
                        color: Theme.of(context).colorScheme.onSurfaceVariant)),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Rider level
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Rider level',
                      style: TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: RiderLevel.values.map((l) {
                      return ChoiceChip(
                        label: Text(l.label),
                        selected: user.profile.level == l,
                        onSelected: (_) => ref
                            .read(authRepositoryProvider)
                            .updateProfile(user.copyWith(
                              profile: user.profile.copyWith(level: l),
                            )),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Goals
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Goals',
                      style: TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: RiderGoal.values.map((g) {
                      final selected = user.goals.contains(g);
                      return FilterChip(
                        label: Text(g.label),
                        selected: selected,
                        onSelected: (on) {
                          final goals = [...user.goals];
                          on ? goals.add(g) : goals.remove(g);
                          ref
                              .read(authRepositoryProvider)
                              .updateProfile(user.copyWith(goals: goals));
                        },
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Preferences
          _PreferenceToggles(user: user),
          const SizedBox(height: 24),

          OutlinedButton.icon(
            onPressed: () async {
              await ref.read(authControllerProvider.notifier).signOut();
              if (context.mounted) context.go('/login');
            },
            icon: const Icon(Icons.logout),
            label: const Text('Sign out'),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(52),
              foregroundColor: AppColors.danger,
            ),
          ),
          const SizedBox(height: 12),
          const Center(
            child: Text(
              '${AppConstants.appName} · ${AppConstants.useMocks ? 'Mock mode' : 'Live mode'}',
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ),
        ],
      ),
    );
  }
}

class _PreferenceToggles extends ConsumerWidget {
  const _PreferenceToggles({required this.user});
  final AppUser user;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final prefs = user.preferences;
    void update(UserPreferences p) =>
        ref.read(authRepositoryProvider).updateProfile(user.copyWith(preferences: p));

    return Card(
      child: Column(
        children: [
          SwitchListTile(
            title: const Text('Metric units (km)'),
            value: prefs.metricUnits,
            onChanged: (v) => update(prefs.copyWith(metricUnits: v)),
          ),
          SwitchListTile(
            title: const Text('Notifications'),
            value: prefs.notificationsEnabled,
            onChanged: (v) => update(prefs.copyWith(notificationsEnabled: v)),
          ),
        ],
      ),
    );
  }
}
