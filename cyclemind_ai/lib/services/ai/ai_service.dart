/// Abstraction over the text-generation AI (the AI Bike Mechanic).
///
/// Architectural decision (Dependency Inversion): the domain/use-case layer
/// depends only on this interface, never on Claude, HTTP, or Firebase. That
/// lets us swap [MockAiService] (default, offline) for [ClaudeAiService]
/// (production, server-proxied) without touching any feature code.
abstract interface class AiService {
  /// AI Bike Mechanic chat turn. [history] is prior turns (oldest first).
  Future<String> mechanicChat(String message, {List<ChatTurn> history = const []});
}

/// One message in the mechanic chat transcript.
class ChatTurn {
  const ChatTurn({required this.role, required this.text});

  /// `user` or `assistant`.
  final String role;
  final String text;

  bool get isUser => role == 'user';
}
