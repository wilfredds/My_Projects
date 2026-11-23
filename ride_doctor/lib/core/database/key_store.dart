import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Where the database encryption key lives. An interface so tests can use an
/// in-memory fake instead of the platform keystore.
abstract interface class KeyStore {
  Future<String?> read();
  Future<void> write(String key);
  Future<void> delete();
}

/// Keeps the key in the platform's secure storage: on Android, encrypted with
/// a key held by the Android Keystore, which the app can use but never read
/// out - so copying the app's files off the phone does not yield the key.
final class SecureKeyStore implements KeyStore {
  const new([this._storage = const FlutterSecureStorage()]);

  static const _name = 'ride_doctor.database_key.v1';

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read() => _storage.read(key: _name);

  @override
  Future<void> write(String key) => _storage.write(key: _name, value: key);

  @override
  Future<void> delete() => _storage.delete(key: _name);
}

/// A new random 256-bit key as 64 hex characters.
///
/// `Random.secure()` draws from the operating system's cryptographic random
/// source. The default `Random()` is predictable and must never make keys.
String generateDatabaseKey([Random? random]) {
  final source = random ?? Random.secure();
  return [
    for (var i = 0; i < 32; i++)
      source.nextInt(256).toRadixString(16).padLeft(2, '0'),
  ].join();
}
