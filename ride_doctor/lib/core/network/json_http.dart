import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

/// Why a request for JSON failed. A sealed family, so callers handle every
/// case: "no signal" is shown differently from "the service is busy".
sealed class FetchFailure implements Exception {
  const new(this.uri);

  final Uri uri;
}

/// No connection, the connection dropped, or no answer in time.
final class NoConnection extends FetchFailure {
  const new(super.uri, this.cause);

  final Object cause;

  @override
  String toString() => 'NoConnection($uri): $cause';
}

/// The service said "too many requests" (HTTP 429). Not retried: asking
/// again straight away only makes it worse.
final class RateLimited extends FetchFailure {
  const new(super.uri);

  @override
  String toString() => 'RateLimited($uri)';
}

/// The service answered with an error status.
final class ServerError extends FetchFailure {
  const new(super.uri, this.statusCode, {this.reason});

  final int statusCode;

  /// The service's own explanation, if it sent one in JSON as
  /// `{"error": true, "reason": "..."}`.
  final String? reason;

  @override
  String toString() => 'ServerError($uri, $statusCode): ${reason ?? ''}';
}

/// The answer arrived but is not usable: too big, not JSON, or not a JSON
/// object.
final class BadResponse extends FetchFailure {
  const new(super.uri, this.problem);

  final String problem;

  @override
  String toString() => 'BadResponse($uri): $problem';
}

/// Fetches JSON over HTTPS, carefully (PROMPT.md section 10: "HTTPS only;
/// validate and sanitize all API responses; timeouts and retries with
/// backoff").
///
/// - Refuses anything but `https:` - a programming error, so it throws.
/// - Gives up on one attempt after [timeout], and closes its connection.
/// - Retries dropped connections, timeouts and 5xx answers up to
///   [maxAttempts] in total, waiting 0.5 s, then 1 s, then 2 s... between
///   attempts. Never retries 4xx answers: those will not change by asking
///   again.
/// - Rejects answers bigger than [maxBytes] before decoding them.
/// - Returns only a JSON object; anything else is a [BadResponse].
///
/// Checking that the object has the expected fields and sane values is the
/// caller's job: only it knows what "expected" means.
final class JsonHttp {
  new(
    this._client, {
    this.timeout = const Duration(seconds: 10),
    this.maxAttempts = 3,
    this.maxBytes = 2 * 1024 * 1024,
    Future<void> Function(Duration)? sleep,
  }) : assert(maxAttempts >= 1, 'at least one attempt'),
       _sleep = sleep ?? Future<void>.delayed;

  final http.Client _client;
  final Duration timeout;
  final int maxAttempts;
  final int maxBytes;
  final Future<void> Function(Duration) _sleep;

  /// The wait before retry number [retry] (1 = first retry).
  static Duration backoff(int retry) =>
      Duration(milliseconds: 500 * (1 << (retry - 1)));

  Future<Map<String, Object?>> getJson(Uri uri) async {
    if (uri.scheme != 'https') {
      throw ArgumentError.value(uri, 'uri', 'must use https');
    }
    FetchFailure? lastFailure;
    for (var attempt = 1; attempt <= maxAttempts; attempt++) {
      if (attempt > 1) await _sleep(backoff(attempt - 1));
      // Completing this closes the connection. A timeout on the Future
      // alone would stop waiting but leave the socket open until the
      // server gave up.
      final abort = Completer<void>();
      final request = http.AbortableRequest(
        'GET',
        uri,
        abortTrigger: abort.future,
      )..headers['Accept'] = 'application/json';
      Future<http.Response> fetch() async =>
          await http.Response.fromStream(await _client.send(request));
      final http.Response response;
      try {
        response = await fetch().timeout(timeout);
      } on TimeoutException catch (error) {
        abort.complete();
        lastFailure = NoConnection(uri, error);
        continue;
      } on http.ClientException catch (error) {
        // On phones this also covers SocketException: http 1.x wraps it.
        lastFailure = NoConnection(uri, error);
        continue;
      }

      final status = response.statusCode;
      if (status == 429) throw RateLimited(uri);
      if (status >= 500) {
        lastFailure = ServerError(uri, status, reason: _reason(response));
        continue;
      }
      if (status != 200) {
        throw ServerError(uri, status, reason: _reason(response));
      }
      return _decodeObject(uri, response);
    }
    throw lastFailure!;
  }

  Map<String, Object?> _decodeObject(Uri uri, http.Response response) {
    if (response.bodyBytes.length > maxBytes) {
      throw BadResponse(uri, 'larger than $maxBytes bytes');
    }
    final Object? decoded;
    try {
      decoded = jsonDecode(utf8.decode(response.bodyBytes));
    } on FormatException {
      throw BadResponse(uri, 'not valid JSON');
    }
    if (decoded is! Map<String, Object?>) {
      throw BadResponse(uri, 'not a JSON object');
    }
    return decoded;
  }

  /// The `reason` field of an error answer, if there is one, cut short so a
  /// hostile server cannot fill the screen.
  String? _reason(http.Response response) {
    try {
      final body = jsonDecode(utf8.decode(response.bodyBytes));
      if (body is Map<String, Object?> && body['reason'] is String) {
        final reason = body['reason']! as String;
        return reason.length > 200 ? reason.substring(0, 200) : reason;
      }
    } on Object {
      // Not JSON: no reason to report.
    }
    return null;
  }
}
