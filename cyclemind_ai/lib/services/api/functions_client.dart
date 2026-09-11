import 'dart:convert';

import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;

import 'package:cyclemind_ai/core/error/exceptions.dart';

/// Supplies the per-call credentials our Cloud Functions require.
///
/// Abstracted so tests (and the mock services) can run without Firebase.
abstract interface class CallCredentials {
  /// Firebase ID token proving *who* is calling.
  Future<String?> idToken();

  /// App Check token proving the call came from a genuine build of the app.
  Future<String?> appCheckToken();
}

/// Real credentials, read from the Firebase SDKs.
class FirebaseCallCredentials implements CallCredentials {
  const FirebaseCallCredentials();

  @override
  Future<String?> idToken() =>
      FirebaseAuth.instance.currentUser?.getIdToken() ?? Future.value(null);

  @override
  Future<String?> appCheckToken() => FirebaseAppCheck.instance.getToken();
}

/// Thin HTTP client for our Cloud Functions.
///
/// SECURITY: the functions front a paid Claude key, so every request carries a
/// Firebase ID token and an App Check token. The server rejects calls missing
/// either (see `functions/src/auth.ts`). Centralised here so no call site can
/// forget — a single unauthenticated caller reopens the billing-drain hole.
class FunctionsClient {
  FunctionsClient({
    http.Client? client,
    String? baseUrl,
    CallCredentials credentials = const FirebaseCallCredentials(),
  })  : _client = client ?? http.Client(),
        _credentials = credentials,
        _baseUrl = baseUrl ??
            const String.fromEnvironment('FUNCTIONS_BASE_URL', defaultValue: '');

  final http.Client _client;
  final CallCredentials _credentials;
  final String _baseUrl;

  Future<Map<String, dynamic>> post(
    String fn,
    Map<String, dynamic> body,
  ) async {
    if (_baseUrl.isEmpty) {
      throw AiException('FUNCTIONS_BASE_URL not configured.');
    }

    final token = await _credentials.idToken();
    if (token == null || token.isEmpty) {
      throw AiException('Not signed in — cannot call AI services.');
    }
    final appCheck = await _credentials.appCheckToken();

    final resp = await _client.post(
      Uri.parse('$_baseUrl/$fn'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
        if (appCheck != null && appCheck.isNotEmpty)
          'X-Firebase-AppCheck': appCheck,
      },
      body: jsonEncode(body),
    );

    if (resp.statusCode == 429) {
      throw AiException('Daily AI usage limit reached. Try again tomorrow.');
    }
    if (resp.statusCode != 200) {
      throw AiException('AI function "$fn" failed: ${resp.statusCode}');
    }
    return jsonDecode(resp.body) as Map<String, dynamic>;
  }
}
