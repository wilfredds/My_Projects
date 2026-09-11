import 'package:cyclemind_ai/services/ai/ai_service.dart';

/// Offline, deterministic implementation of [AiService].
///
/// This is the default implementation (`USE_MOCKS=true`) so the app is fully
/// usable with no API keys and no Firebase project.
class MockAiService implements AiService {
  @override
  Future<String> mechanicChat(
    String message, {
    List<ChatTurn> history = const [],
  }) async {
    await _simulateLatency();
    final lower = message.toLowerCase();
    if (lower.contains('skip') || lower.contains('slip') || lower.contains('gear')) {
      return 'Sounds like a cable-tension or chain-wear issue. A few questions: '
          'Which groupset are you running? Does it skip under load (climbing) or on every gear? '
          'A quarter-turn of the barrel adjuster counter-clockwise often fixes minor skipping.';
    }
    if (lower.contains('brake')) {
      return 'For brake issues I\'d check pad thickness first (replace under 1 mm), then '
          'clean the rotor with isopropyl alcohol. Are the brakes squealing, or feeling spongy?';
    }
    return 'Tell me a bit more — what\'s the symptom, when did it start, and which bike '
        'and groupset? I\'ll walk you through a diagnosis step by step.';
  }

  Future<void> _simulateLatency() =>
      Future<void>.delayed(const Duration(milliseconds: 400));
}
