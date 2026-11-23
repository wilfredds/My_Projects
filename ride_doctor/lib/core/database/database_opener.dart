import 'dart:io';

import 'package:drift/native.dart';
import 'package:ride_doctor/core/database/app_database.dart';
import 'package:ride_doctor/core/database/key_store.dart';
import 'package:sqlite3/sqlite3.dart';

/// Thrown when the SQLite library loaded at runtime cannot encrypt. We refuse
/// to continue rather than quietly store health data in plain text.
final class EncryptionUnavailable implements Exception {
  const new();

  @override
  String toString() => 'EncryptionUnavailable: SQLite has no cipher support';
}

/// Thrown when a database file exists but cannot be opened with the stored
/// key - for example the keystore was cleared, or the file is corrupt.
final class DatabaseUnreadable implements Exception {
  const new(this.cause);

  final Object cause;

  @override
  String toString() => 'DatabaseUnreadable: $cause';
}

/// Opens (creating on first launch) the encrypted database at [file].
///
/// The key is generated once, on first launch, and kept in [keyStore]. It is
/// never logged, never written next to the database, and never leaves the
/// device.
Future<AppDatabase> openEncryptedDatabase({
  required File file,
  required KeyStore keyStore,
}) async {
  assertEncryptionAvailable();

  var key = await keyStore.read();
  if (key == null) {
    key = generateDatabaseKey();
    await keyStore.write(key);
  }
  // Only our own hex characters are ever interpolated into the PRAGMA, but
  // check anyway: a key from anywhere else must not be able to inject SQL.
  if (!RegExp(r'^[0-9a-f]{64}$').hasMatch(key)) {
    throw const DatabaseUnreadable('stored key is malformed');
  }

  final database = AppDatabase(
    NativeDatabase(file, setup: (raw) => _unlock(raw, key!)),
  );
  try {
    // Force the file to be opened and read now, so a wrong key surfaces here
    // as a typed error instead of on some later, unrelated query.
    await database.customSelect('SELECT count(*) FROM sqlite_master').get();
  } on Object catch (error) {
    await database.close();
    throw DatabaseUnreadable(error);
  }
  return database;
}

/// Plain SQLite silently ignores `PRAGMA key` and would then write an
/// unencrypted file. `PRAGMA cipher` only answers in the encrypting build (an
/// unknown pragma returns no rows), so an empty answer means: stop.
void assertEncryptionAvailable() {
  final probe = sqlite3.openInMemory();
  try {
    if (probe.select('PRAGMA cipher').isEmpty) {
      throw const EncryptionUnavailable();
    }
  } finally {
    probe.close();
  }
}

// The key must be the very first statement: until it is set, any query that
// touches an existing encrypted file fails with "file is not a database".
void _unlock(Database raw, String key) => raw.execute("PRAGMA key = '$key'");

/// Deletes the database file and its key. After this the next launch starts
/// from nothing, with a fresh key.
Future<void> destroyEncryptedDatabase({
  required File file,
  required KeyStore keyStore,
}) async {
  for (final suffix in const ['', '-wal', '-shm', '-journal']) {
    final part = File('${file.path}$suffix');
    if (part.existsSync()) part.deleteSync();
  }
  await keyStore.delete();
}
