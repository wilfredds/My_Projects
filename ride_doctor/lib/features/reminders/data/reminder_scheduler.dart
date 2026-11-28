import 'package:meta/meta.dart';

/// Whether the app may show notifications on this device.
enum NotificationAccess {
  granted,
  denied,

  /// This build cannot schedule them at all (the web preview).
  unsupported,
}

/// A notification ready to hand to the phone: already worded in the
/// rider's language.
@immutable
final class PhoneNotification {
  const new({
    required this.id,
    required this.at,
    required this.title,
    required this.body,
    required this.route,
    this.repeatsDaily = false,
  });

  final int id;

  /// Local wall-clock time.
  final DateTime at;
  final String title;
  final String body;

  /// Where a tap takes the rider. Must be one of [reminderRoutes].
  final String route;
  final bool repeatsDaily;

  @override
  bool operator ==(Object other) =>
      other is PhoneNotification &&
      other.id == id &&
      other.at == at &&
      other.title == title &&
      other.body == body &&
      other.route == route &&
      other.repeatsDaily == repeatsDaily;

  @override
  int get hashCode => Object.hash(id, at, title, body, route, repeatsDaily);

  @override
  String toString() => 'PhoneNotification($id at $at: $title)';
}

/// The only places a notification tap may open. A tap's payload comes back
/// from outside the app, so anything else is ignored rather than followed.
const reminderRoutes = {'/', '/check-in'};

/// The phone's notification system, behind an interface so tests (and the
/// web preview) never touch the real plugin - which throws in a test run.
abstract interface class ReminderScheduler {
  /// Whether notifications are allowed now. Never prompts.
  Future<NotificationAccess> access();

  /// Asks Android for permission (from Android 13 it is off until the
  /// rider allows it). Call only when the rider has just switched a
  /// reminder on, so they know why they are being asked.
  Future<NotificationAccess> requestAccess();

  /// Opens the system's notification settings for this app, for a rider who
  /// said no earlier and changed their mind.
  Future<void> openSystemSettings();

  /// Replaces every reminder this app has scheduled with [notifications].
  Future<void> replaceAll(List<PhoneNotification> notifications);

  /// The route of the reminder whose tap started the app, if one did. Read
  /// once at start-up.
  Future<String?> launchRoute();

  /// Routes of reminders tapped while the app is running.
  Stream<String> get taps;

  /// Re-reads the phone's time zone. True when it changed since the last
  /// call, which means every reminder must be scheduled again: the plugin
  /// keeps firing in the old zone otherwise.
  Future<bool> syncTimeZone();
}

/// The web preview: a browser cannot schedule notifications for later.
final class UnsupportedReminderScheduler implements ReminderScheduler {
  const new();

  @override
  Future<NotificationAccess> access() async => NotificationAccess.unsupported;

  @override
  Future<NotificationAccess> requestAccess() async =>
      NotificationAccess.unsupported;

  @override
  Future<void> openSystemSettings() async {}

  @override
  Future<void> replaceAll(List<PhoneNotification> notifications) async {}

  @override
  Future<String?> launchRoute() async => null;

  @override
  Stream<String> get taps => const Stream.empty();

  @override
  Future<bool> syncTimeZone() async => false;
}
