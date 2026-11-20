import 'package:flutter/widgets.dart';
import 'package:ride_doctor/l10n/generated/app_localizations.dart';

export 'package:ride_doctor/l10n/generated/app_localizations.dart';

/// `context.l10n.todayTitle` instead of `AppLocalizations.of(context)...`.
extension AppLocalizationsContext on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this);
}
