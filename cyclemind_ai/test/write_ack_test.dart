import 'dart:async';

import 'package:cyclemind_ai/core/utils/write_ack.dart';
import 'package:flutter_test/flutter_test.dart';

/// awaitServerAck is the whole offline fix in one function: offline, a
/// Firestore write's Future never settles (premise C11a), so every save used
/// to wait forever. Real millisecond timeouts keep this free of fake_async.
void main() {
  const short = Duration(milliseconds: 50);

  test('confirmed when the server answers in time', () async {
    expect(await awaitServerAck(Future<void>.value(), timeout: short),
        WriteAck.confirmed);
  });

  test('queued, not waited on forever, when the server never answers',
      () async {
    final offline = Completer<void>();
    final clock = Stopwatch()..start();

    expect(await awaitServerAck(offline.future, timeout: short),
        WriteAck.queued);
    expect(clock.elapsed, lessThan(const Duration(seconds: 2)));
  });

  test('a rejection in time is rethrown, so it is still reported as one',
      () async {
    await expectLater(
      awaitServerAck(Future<void>.error(StateError('denied')), timeout: short),
      throwsStateError,
    );
  });

  test('a rejection AFTER the timeout reaches onLateFailure', () async {
    // C11c: Firestore rolls such a write back on the device silently. This
    // callback is the only way the rider can be told.
    final write = Completer<void>();
    final lateErrors = <Object>[];

    expect(
      await awaitServerAck(write.future,
          timeout: short, onLateFailure: lateErrors.add),
      WriteAck.queued,
    );
    write.completeError(StateError('permission-denied'));
    await Future<void>.delayed(Duration.zero);

    expect(lateErrors.single, isA<StateError>());
  });

  test('a late success is silent', () async {
    final write = Completer<void>();
    final lateErrors = <Object>[];

    await awaitServerAck(write.future,
        timeout: short, onLateFailure: lateErrors.add);
    write.complete();
    await Future<void>.delayed(Duration.zero);

    expect(lateErrors, isEmpty);
  });

  test('a late rejection with no callback is still handled, never uncaught',
      () async {
    final write = Completer<void>();
    await awaitServerAck(write.future, timeout: short);
    write.completeError(StateError('denied'));
    await Future<void>.delayed(Duration.zero);
    // An uncaught async error would fail this test; reaching here is the
    // assertion.
  });
}
