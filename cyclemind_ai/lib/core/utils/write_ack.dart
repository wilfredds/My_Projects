import 'dart:async';

import 'package:cyclemind_ai/core/constants/app_constants.dart';

/// How a write was saved.
enum WriteAck {
  /// The server confirmed it.
  confirmed,

  /// The server didn't answer in time, almost always because the device is
  /// offline. Firestore has already applied the write on this device, so the
  /// lists and wear bars show it, and delivers it when the connection returns
  /// (firestore-tests/premise.test.js C11a–b).
  queued,
}

/// Appended to a confirmation when the write was [WriteAck.queued].
const savedOfflineNote = "Saved offline — it'll sync when you're back online.";

/// Waits for the server to acknowledge [write], but never longer than
/// [timeout].
///
/// A Firestore write's Future settles only when the SERVER answers. Offline it
/// never settles, so every save the rider waited on used to spin until the
/// signal came back.
///
/// - Completes in time: [WriteAck.confirmed].
/// - Fails in time: rethrows, so an online rejection is still reported as one.
/// - Still pending: [WriteAck.queued]. It keeps listening, because if the
///   server later REJECTS the write, Firestore rolls it back on the device
///   without a word (C11c). [onLateFailure] is how the rider hears about it.
Future<WriteAck> awaitServerAck(
  Future<void> write, {
  Duration timeout = AppConstants.writeAckTimeout,
  void Function(Object error)? onLateFailure,
}) async {
  try {
    await write.timeout(timeout);
    return WriteAck.confirmed;
  } on TimeoutException {
    unawaited(write.then<void>(
      (_) {},
      onError: (Object error) => onLateFailure?.call(error),
    ));
    return WriteAck.queued;
  }
}
