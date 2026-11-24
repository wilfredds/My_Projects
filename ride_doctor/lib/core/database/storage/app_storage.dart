import 'package:ride_doctor/core/database/app_database.dart';

/// How this platform opens, and can throw away, the app's database.
///
/// The phone app and the web preview store data in completely different ways,
/// and their code cannot even be compiled together: the phone side uses
/// `dart:ffi` to talk to native SQLite, which does not exist in a browser.
/// This interface is the one thing both sides agree on; `create_storage.dart`
/// picks the right implementation at compile time.
abstract interface class AppStorage {
  /// True when data outlives the session. The web preview keeps everything in
  /// memory, so it is false there, and the app says so on screen rather than
  /// repeating promises about encrypted storage that do not apply.
  bool get persists;

  Future<AppDatabase> open();

  /// Removes the stored database (and its key) so the next [open] starts
  /// from nothing.
  Future<void> destroy();
}
