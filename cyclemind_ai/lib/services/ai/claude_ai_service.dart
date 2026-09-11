import 'package:cyclemind_ai/services/ai/ai_service.dart';
import 'package:cyclemind_ai/services/api/functions_client.dart';

/// Production [AiService] that proxies to server-side Cloud Functions.
///
/// SECURITY (architectural decision): the Claude API key is NEVER shipped in
/// the app. Each method posts to an HTTPS Cloud Function (see
/// `functions/src/index.ts`) which holds the key and calls Claude server-side.
/// [FunctionsClient] attaches the Firebase ID token and App Check token the
/// functions require. This impl is selected only when
/// `--dart-define=USE_MOCKS=false` and a `FUNCTIONS_BASE_URL` is provided.
class ClaudeAiService implements AiService {
  ClaudeAiService({FunctionsClient? client})
      : _client = client ?? FunctionsClient();

  final FunctionsClient _client;

  @override
  Future<String> mechanicChat(
    String message, {
    List<ChatTurn> history = const [],
  }) async {
    final json = await _client.post('mechanicChat', {
      'message': message,
      'history': history.map((t) => {'role': t.role, 'text': t.text}).toList(),
    });
    return json['reply'] as String? ?? '';
  }
}
