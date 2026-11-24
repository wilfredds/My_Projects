import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:ride_doctor/core/database/app_database.dart';
import 'package:ride_doctor/core/database/database_opener.dart';
import 'package:ride_doctor/core/database/key_store.dart';
import 'package:ride_doctor/core/database/storage/app_storage.dart';

AppStorage createAppStorage() => const EncryptedFileStorage();

/// The real thing: an encrypted file in the app's private support directory
/// (not readable by other apps, not a user-visible folder), with its key in
/// the platform keystore.
final class EncryptedFileStorage implements AppStorage {
  const new({this.keyStore = const SecureKeyStore()});

  final KeyStore keyStore;

  @override
  bool get persists => true;

  Future<File> _file() async {
    final directory = await getApplicationSupportDirectory();
    return File(p.join(directory.path, 'ride_doctor.db'));
  }

  @override
  Future<AppDatabase> open() async =>
      await openEncryptedDatabase(file: await _file(), keyStore: keyStore);

  @override
  Future<void> destroy() async =>
      await destroyEncryptedDatabase(file: await _file(), keyStore: keyStore);
}
