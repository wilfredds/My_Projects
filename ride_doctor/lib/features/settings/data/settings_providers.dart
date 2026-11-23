import 'package:ride_doctor/core/app/environment.dart';
import 'package:ride_doctor/core/database/database_providers.dart';
import 'package:ride_doctor/features/settings/data/drift_settings_repository.dart';
import 'package:ride_doctor/features/settings/domain/settings_repository.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'settings_providers.g.dart';

@Riverpod(keepAlive: true)
Future<SettingsRepository> settingsRepository(Ref ref) async =>
    DriftSettingsRepository(
      await ref.watch(appDatabaseProvider.future),
      clock: ref.watch(clockProvider),
    );
