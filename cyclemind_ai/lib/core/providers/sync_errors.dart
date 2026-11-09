import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Writes that were reported "saved offline" and later REJECTED by the server.
///
/// Firestore rolls such a write back on the device silently
/// (firestore-tests/premise.test.js C11c), so a ride the rider logged just
/// vanishes from the list. Repositories report it here, and
/// `SyncErrorListener` tells the rider.
class SyncErrors {
  final _controller = StreamController<String>.broadcast();

  /// One user-facing message per rejected write.
  Stream<String> get messages => _controller.stream;

  void report(String message) => _controller.add(message);

  void dispose() => _controller.close();
}

final syncErrorsProvider = Provider<SyncErrors>((ref) {
  final errors = SyncErrors();
  ref.onDispose(errors.dispose);
  return errors;
});
