import 'package:ride_doctor/core/database/key_store.dart';

/// An in-memory stand-in for the platform keystore.
final class FakeKeyStore implements KeyStore {
  new([this.key]);

  String? key;
  int writes = 0;

  @override
  Future<String?> read() async => key;

  @override
  Future<void> write(String key) async {
    this.key = key;
    writes++;
  }

  @override
  Future<void> delete() async => key = null;
}
