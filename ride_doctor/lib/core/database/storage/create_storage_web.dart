import 'package:drift/wasm.dart';
import 'package:ride_doctor/core/database/app_database.dart';
import 'package:ride_doctor/core/database/storage/app_storage.dart';
import 'package:sqlite3/wasm.dart';

AppStorage createAppStorage() => const WebPreviewStorage();

/// The web preview: the same database schema and code, but held in the
/// browser tab's memory. Nothing is written anywhere, so reloading the page
/// starts over.
///
/// That is deliberate. A browser has no keystore to hold an encryption key
/// safely, so anything saved there could not honestly be called protected.
/// A preview that forgets is better than one that quietly keeps health data
/// in a weaker place than the app promises.
final class WebPreviewStorage implements AppStorage {
  const new();

  @override
  bool get persists => false;

  @override
  Future<AppDatabase> open() async {
    // SQLite compiled to WebAssembly, served next to the app (web/sqlite3.wasm,
    // fetched by tool/fetch_web_sqlite.sh).
    final sqlite3 = await WasmSqlite3.loadFromUrl(Uri.parse('sqlite3.wasm'));
    // SQLite in the browser starts with no way to store anything. Without a
    // registered file system every open fails with "no such vfs".
    sqlite3.registerVirtualFileSystem(InMemoryFileSystem(), makeDefault: true);
    return AppDatabase(WasmDatabase.inMemory(sqlite3));
  }

  @override
  Future<void> destroy() async {}
}
