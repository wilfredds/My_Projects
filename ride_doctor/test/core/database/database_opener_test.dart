import 'dart:io';
import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/core/database/app_database.dart';
import 'package:ride_doctor/core/database/database_opener.dart';
import 'package:ride_doctor/core/database/key_store.dart';
import 'package:sqlite3/sqlite3.dart';

import '../../helpers/fake_key_store.dart';

const marker = 'PLAINTEXT_MARKER_QUADS_CRAMP';

Future<void> writeMarker(AppDatabase database) => database
    .into(database.sensors)
    .insert(
      SensorsCompanion.insert(
        id: 'sensor-1',
        createdAt: DateTime.utc(2026),
        updatedAt: DateTime.utc(2026),
        kind: marker,
      ),
    );

void main() {
  late Directory directory;
  late File file;

  setUp(() {
    directory = Directory.systemTemp.createTempSync('ride_doctor_db_test');
    file = File('${directory.path}/ride_doctor.db');
  });

  tearDown(() => directory.deleteSync(recursive: true));

  test('first launch generates a key, stores it once, and reuses it', () async {
    final keyStore = FakeKeyStore();

    final first = await openEncryptedDatabase(file: file, keyStore: keyStore);
    await writeMarker(first);
    await first.close();
    final key = keyStore.key;
    expect(key, matches(RegExp(r'^[0-9a-f]{64}$')));
    expect(keyStore.writes, 1);

    final second = await openEncryptedDatabase(file: file, keyStore: keyStore);
    final rows = await second.select(second.sensors).get();
    await second.close();
    expect(rows.single.kind, marker);
    expect(keyStore.key, key);
    expect(keyStore.writes, 1);
  });

  test(
    'the file on disk is encrypted: no SQLite header, no plaintext',
    () async {
      final database = await openEncryptedDatabase(
        file: file,
        keyStore: FakeKeyStore(),
      );
      await writeMarker(database);
      await database.close();

      final bytes = file.readAsBytesSync();
      expect(bytes, isNotEmpty);
      // Every unencrypted SQLite file starts with exactly this text.
      expect(String.fromCharCodes(bytes.take(15)), isNot('SQLite format 3'));
      expect(String.fromCharCodes(bytes), isNot(contains(marker)));
    },
  );

  test('the file cannot be read without the key', () async {
    final database = await openEncryptedDatabase(
      file: file,
      keyStore: FakeKeyStore(),
    );
    await writeMarker(database);
    await database.close();

    final raw = sqlite3.open(file.path);
    addTearDown(raw.close);
    expect(
      () => raw.select('SELECT * FROM sensors'),
      throwsA(isA<SqliteException>()),
    );
  });

  test('a different key is rejected with DatabaseUnreadable', () async {
    final database = await openEncryptedDatabase(
      file: file,
      keyStore: FakeKeyStore(),
    );
    await writeMarker(database);
    await database.close();

    // What happens if the keystore is wiped: a new key is generated and the
    // old file no longer opens.
    await expectLater(
      openEncryptedDatabase(file: file, keyStore: FakeKeyStore()),
      throwsA(isA<DatabaseUnreadable>()),
    );
  });

  test('a malformed stored key is rejected, never interpolated', () async {
    await expectLater(
      openEncryptedDatabase(
        file: file,
        keyStore: FakeKeyStore("x'; ATTACH DATABASE '/tmp/evil' AS e; --"),
      ),
      throwsA(isA<DatabaseUnreadable>()),
    );
    expect(file.existsSync(), isFalse);
  });

  test(
    'destroy removes the file and the key; the next open starts clean',
    () async {
      final keyStore = FakeKeyStore();
      final database = await openEncryptedDatabase(
        file: file,
        keyStore: keyStore,
      );
      await writeMarker(database);
      await database.close();
      final oldKey = keyStore.key;

      await destroyEncryptedDatabase(file: file, keyStore: keyStore);
      expect(file.existsSync(), isFalse);
      expect(keyStore.key, isNull);

      final fresh = await openEncryptedDatabase(file: file, keyStore: keyStore);
      addTearDown(fresh.close);
      expect(await fresh.select(fresh.sensors).get(), isEmpty);
      expect(keyStore.key, isNot(oldKey));
    },
  );

  test('foreign keys are enforced', () async {
    final database = await openEncryptedDatabase(
      file: file,
      keyStore: FakeKeyStore(),
    );
    addTearDown(database.close);

    await expectLater(
      database
          .into(database.drivetrains)
          .insert(
            DrivetrainsCompanion.insert(
              id: 'd1',
              createdAt: DateTime.utc(2026),
              updatedAt: DateTime.utc(2026),
              bikeId: 'no-such-bike',
              chainrings: '34,50',
              cogs: '11,34',
              cogsConfirmed: false,
            ),
          ),
      throwsA(isA<SqliteException>()),
    );
  });

  group('generateDatabaseKey', () {
    test('is 64 lowercase hex characters', () {
      expect(generateDatabaseKey(), matches(RegExp(r'^[0-9a-f]{64}$')));
    });

    test('differs every time', () {
      final keys = {for (var i = 0; i < 50; i++) generateDatabaseKey()};
      expect(keys, hasLength(50));
    });

    test('uses the random source it is given', () {
      expect(generateDatabaseKey(Random(1)), generateDatabaseKey(Random(1)));
    });
  });

  test('error types describe themselves', () {
    expect(const EncryptionUnavailable().toString(), contains('cipher'));
    expect(const DatabaseUnreadable('boom').toString(), contains('boom'));
  });
}
