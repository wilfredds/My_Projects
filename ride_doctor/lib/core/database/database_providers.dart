import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:ride_doctor/core/database/app_database.dart';
import 'package:ride_doctor/core/database/database_opener.dart';
import 'package:ride_doctor/core/database/key_store.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'database_providers.g.dart';

@Riverpod(keepAlive: true)
KeyStore keyStore(Ref ref) => const SecureKeyStore();

/// Where the database file lives: the app's private support directory, which
/// other apps cannot read and which is not a user-visible "Documents" folder.
@Riverpod(keepAlive: true)
Future<File> databaseFile(Ref ref) async {
  final directory = await getApplicationSupportDirectory();
  return File(p.join(directory.path, 'ride_doctor.db'));
}

/// The one open database. Everything that stores data depends on this, so
/// tests replace the whole storage layer by overriding this single provider
/// with an in-memory database.
@Riverpod(keepAlive: true)
Future<AppDatabase> appDatabase(Ref ref) async {
  final database = await openEncryptedDatabase(
    file: await ref.watch(databaseFileProvider.future),
    keyStore: ref.watch(keyStoreProvider),
  );
  ref.onDispose(database.close);
  return database;
}
