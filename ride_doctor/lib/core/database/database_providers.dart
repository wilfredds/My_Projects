import 'package:ride_doctor/core/database/app_database.dart';
import 'package:ride_doctor/core/database/storage/app_storage.dart';
import 'package:ride_doctor/core/database/storage/create_storage.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'database_providers.g.dart';

/// How this platform stores the database: an encrypted file on a phone, or
/// memory only in the web preview.
@Riverpod(keepAlive: true)
AppStorage appStorage(Ref ref) => createAppStorage();

/// The one open database. Everything that stores data depends on this, so
/// tests replace the whole storage layer by overriding this single provider
/// with an in-memory database.
@Riverpod(keepAlive: true)
Future<AppDatabase> appDatabase(Ref ref) async {
  final database = await ref.watch(appStorageProvider).open();
  ref.onDispose(database.close);
  return database;
}
