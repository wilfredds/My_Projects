import 'dart:async';

import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:ride_doctor/features/reminders/data/reminder_scheduler.dart';
import 'package:timezone/data/latest_all.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;

/// Reminders through flutter_local_notifications, on Android.
///
/// Not unit-tested: the plugin talks to Android and throws in a test run.
/// Everything it is given is planned and worded by tested code; this class
/// only hands it over. Delivery on a real phone has not been verified from
/// the build environment (there is no device there).
final class LocalNotificationsScheduler implements ReminderScheduler {
  new([FlutterLocalNotificationsPlugin? plugin])
    : _plugin = plugin ?? FlutterLocalNotificationsPlugin();

  final FlutterLocalNotificationsPlugin _plugin;
  final _taps = StreamController<String>.broadcast();
  Future<void>? _ready;

  /// The status-bar icon, kept in release builds by res/raw/keep.xml.
  static const _icon = 'ic_stat_reminder';

  /// One channel for both reminders. Its name and description appear in the
  /// phone's settings, where the rider can silence it.
  static const _channelId = 'daily_reminders';
  static const _channelName = 'Daily reminders';
  static const _channelDescription =
      'The morning plan and the evening check-in';

  /// If the phone reports a zone the time-zone data does not know, assume
  /// the Philippines, where the app is built for. Our own fallback.
  static const _fallbackZone = 'Asia/Manila';

  Future<void> _ensureReady() => _ready ??= _initialise();

  Future<void> _initialise() async {
    tz_data.initializeTimeZones();
    await _setLocalZone();
    await _plugin.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings(_icon),
      ),
      onDidReceiveNotificationResponse: (response) {
        final route = _allowedRoute(response.payload);
        if (route != null) _taps.add(route);
      },
    );
  }

  /// Sets the time zone the reminders are scheduled in. True when it moved.
  Future<bool> _setLocalZone() async {
    final id = (await FlutterTimezone.getLocalTimezone()).identifier;
    tz.Location location;
    try {
      location = tz.getLocation(id);
    } on tz.LocationNotFoundException {
      location = tz.getLocation(_fallbackZone);
    }
    // Before the first set, tz.local is UTC.
    final changed = tz.local.name != location.name;
    tz.setLocalLocation(location);
    return changed;
  }

  AndroidFlutterLocalNotificationsPlugin? get _android => _plugin
      .resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin
      >();

  @override
  Future<NotificationAccess> access() async {
    await _ensureReady();
    final enabled = await _android?.areNotificationsEnabled() ?? false;
    return enabled ? NotificationAccess.granted : NotificationAccess.denied;
  }

  @override
  Future<NotificationAccess> requestAccess() async {
    await _ensureReady();
    final android = _android;
    if (android == null) return NotificationAccess.unsupported;
    if (await android.areNotificationsEnabled() ?? false) {
      return NotificationAccess.granted;
    }
    final granted = await android.requestNotificationsPermission() ?? false;
    return granted ? NotificationAccess.granted : NotificationAccess.denied;
  }

  @override
  Future<void> openSystemSettings() async {
    await _ensureReady();
    await _plugin.openAppNotificationSettings();
  }

  @override
  Future<void> replaceAll(List<PhoneNotification> notifications) async {
    await _ensureReady();
    await _plugin.cancelAll();
    for (final notification in notifications) {
      final at = notification.at;
      await _plugin.zonedSchedule(
        id: notification.id,
        title: notification.title,
        body: notification.body,
        scheduledDate: tz.TZDateTime(
          tz.local,
          at.year,
          at.month,
          at.day,
          at.hour,
          at.minute,
        ),
        notificationDetails: NotificationDetails(
          android: AndroidNotificationDetails(
            _channelId,
            _channelName,
            channelDescription: _channelDescription,
            icon: _icon,
            // On a locked phone, show that a reminder arrived but not what
            // it says: a training plan is the rider's own business.
            visibility: NotificationVisibility.private,
            styleInformation: BigTextStyleInformation(notification.body),
          ),
        ),
        // Inexact on purpose: exact alarms need a permission Android 14 no
        // longer grants by default, and "around 05:30" is fine for a
        // reminder. Android may deliver it up to an hour late, or later
        // when the phone is saving battery.
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        matchDateTimeComponents: notification.repeatsDaily
            ? DateTimeComponents.time
            : null,
        payload: notification.route,
      );
    }
  }

  @override
  Future<String?> launchRoute() async {
    await _ensureReady();
    final details = await _plugin.getNotificationAppLaunchDetails();
    if (!(details?.didNotificationLaunchApp ?? false)) return null;
    return _allowedRoute(details?.notificationResponse?.payload);
  }

  @override
  Stream<String> get taps => _taps.stream;

  @override
  Future<bool> syncTimeZone() async {
    await _ensureReady();
    return await _setLocalZone();
  }

  static String? _allowedRoute(String? payload) =>
      reminderRoutes.contains(payload) ? payload : null;
}
