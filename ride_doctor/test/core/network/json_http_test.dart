import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ride_doctor/core/network/json_http.dart';

final Uri uri = Uri.parse('https://api.example.test/v1/forecast?latitude=14.3');

/// A client that answers from a list, one answer per request, and records
/// how many requests were made.
final class Scripted {
  new(this.answers);

  final List<FutureOr<http.Response> Function()> answers;
  int requests = 0;
  final sleeps = <Duration>[];

  JsonHttp client({int maxAttempts = 3, int maxBytes = 2 * 1024 * 1024}) =>
      JsonHttp(
        MockClient((request) async {
          expect(request.headers['Accept'], 'application/json');
          return await answers[requests++]();
        }),
        maxAttempts: maxAttempts,
        maxBytes: maxBytes,
        timeout: const Duration(milliseconds: 50),
        sleep: (duration) async => sleeps.add(duration),
      );
}

http.Response json(Object body, [int status = 200]) =>
    http.Response(jsonEncode(body), status);

void main() {
  test('returns the decoded object', () async {
    final script = Scripted([
      () => json({'latitude': 14.3, 'ok': true}),
    ]);

    expect(await script.client().getJson(uri), {'latitude': 14.3, 'ok': true});
    expect(script.requests, 1);
  });

  test('decodes UTF-8 whatever the content type says', () async {
    final script = Scripted([
      () => http.Response.bytes(utf8.encode('{"name":"Dasmariñas"}'), 200),
    ]);

    expect((await script.client().getJson(uri))['name'], 'Dasmariñas');
  });

  test('refuses plain http without making a request', () async {
    final script = Scripted([]);

    await expectLater(
      script.client().getJson(Uri.parse('http://api.example.test/x')),
      throwsArgumentError,
    );
    expect(script.requests, 0);
  });

  group('retries', () {
    test('a dropped connection is retried with growing waits', () async {
      final script = Scripted([
        () => throw http.ClientException('connection reset'),
        () => throw http.ClientException('connection reset'),
        () => json({'ok': true}),
      ]);

      expect(await script.client().getJson(uri), {'ok': true});
      expect(script.requests, 3);
      expect(script.sleeps, [
        const Duration(milliseconds: 500),
        const Duration(seconds: 1),
      ]);
    });

    test('a timeout is retried, then reported as no connection', () async {
      final script = Scripted([
        for (var i = 0; i < 3; i++)
          () => Future<http.Response>.delayed(
            const Duration(seconds: 1),
            () => json({}),
          ),
      ]);

      await expectLater(
        script.client().getJson(uri),
        throwsA(isA<NoConnection>()),
      );
      expect(script.requests, 3);
    });

    test('a server error is retried, then reported with its reason', () async {
      final script = Scripted([
        for (var i = 0; i < 3; i++)
          () => json({'error': true, 'reason': 'overloaded'}, 503),
      ]);

      final failure = await script
          .client()
          .getJson(uri)
          .then<Object?>((_) => null, onError: (Object e) => e);
      expect(failure, isA<ServerError>());
      final serverError = failure! as ServerError;
      expect(serverError.statusCode, 503);
      expect(serverError.reason, 'overloaded');
      expect(script.requests, 3);
    });

    test('maxAttempts 1 means no retry at all', () async {
      final script = Scripted([() => throw http.ClientException('down')]);

      await expectLater(
        script.client(maxAttempts: 1).getJson(uri),
        throwsA(isA<NoConnection>()),
      );
      expect(script.sleeps, isEmpty);
    });

    test('backoff doubles', () {
      expect([1, 2, 3, 4].map(JsonHttp.backoff), [
        const Duration(milliseconds: 500),
        const Duration(seconds: 1),
        const Duration(seconds: 2),
        const Duration(seconds: 4),
      ]);
    });
  });

  group('never retried', () {
    test('429 is reported at once as rate limited', () async {
      final script = Scripted([
        () => json({
          'reason':
              'Daily API request limit exceeded. Please try again '
              'tomorrow.',
          'error': true,
        }, 429),
      ]);

      await expectLater(
        script.client().getJson(uri),
        throwsA(isA<RateLimited>()),
      );
      expect(script.requests, 1);
    });

    test('a 4xx answer is reported at once with its reason', () async {
      final script = Scripted([
        () => json({'error': true, 'reason': 'Latitude must be in range'}, 400),
      ]);

      final failure = await script
          .client()
          .getJson(uri)
          .then<Object?>((_) => null, onError: (Object e) => e);
      expect(failure, isA<ServerError>());
      expect((failure! as ServerError).reason, 'Latitude must be in range');
      expect(script.requests, 1);
    });

    test('a long error reason is cut short', () async {
      final script = Scripted([
        () => json({'error': true, 'reason': 'x' * 5000}, 400),
      ]);

      final failure = await script
          .client()
          .getJson(uri)
          .then<Object?>((_) => null, onError: (Object e) => e);
      expect((failure! as ServerError).reason, hasLength(200));
    });
  });

  group('bad answers', () {
    test('not JSON', () async {
      final script = Scripted([() => http.Response('<html>oops</html>', 200)]);

      await expectLater(
        script.client().getJson(uri),
        throwsA(isA<BadResponse>()),
      );
    });

    test('JSON but not an object', () async {
      final script = Scripted([
        () => json([1, 2, 3]),
      ]);

      await expectLater(
        script.client().getJson(uri),
        throwsA(isA<BadResponse>()),
      );
    });

    test('too big, rejected before decoding', () async {
      final script = Scripted([
        () => json({'data': 'x' * 2000}),
      ]);

      await expectLater(
        script.client(maxBytes: 1000).getJson(uri),
        throwsA(isA<BadResponse>()),
      );
    });

    test('an unexpected 2xx status is an error', () async {
      final script = Scripted([() => json({}, 204)]);

      await expectLater(
        script.client().getJson(uri),
        throwsA(isA<ServerError>()),
      );
    });
  });

  test('failures describe themselves', () {
    expect(NoConnection(uri, 'x').toString(), contains('NoConnection'));
    expect(RateLimited(uri).toString(), contains('RateLimited'));
    expect(ServerError(uri, 500).toString(), contains('500'));
    expect(BadResponse(uri, 'odd').toString(), contains('odd'));
  });
}
