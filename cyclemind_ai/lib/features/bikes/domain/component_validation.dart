import 'package:cyclemind_ai/core/constants/app_constants.dart';

// Validation shared by the add-component form, the replace form and the
// ReplaceComponent use case, so the three cannot drift apart.

/// Parses a km figure the rider typed. Null for anything that is not a finite
/// number.
///
/// `double.tryParse` alone is not enough: it accepts "NaN" and "Infinity". A
/// NaN lifespan renders as 999% on a full GREEN bar and never raises a
/// reminder, which is exactly the silent failure this app exists to prevent.
double? parseFiniteKm(String? text) {
  final v = double.tryParse((text ?? '').trim());
  if (v == null || !v.isFinite) return null;
  return v;
}

/// Null when [lifespanKm] is a usable component lifespan, otherwise why not.
String? lifespanError(double? lifespanKm) {
  if (lifespanKm == null || !lifespanKm.isFinite) return 'Enter a number of km';
  if (lifespanKm < 1) return 'Must be at least 1 km';
  if (lifespanKm > AppConstants.maxComponentLifespanKm) {
    return 'That lifespan looks too large';
  }
  return null;
}

/// Null when [km] is a usable "already ridden on this part" figure.
String? alreadyRiddenError(double? km) => _kmRangeError(km);

/// Null when [km] is a usable odometer reading. Mirrors
/// `numIn(d.totalMileageKm, 0, 500000)` on bikes.
String? odometerError(double? km) => _kmRangeError(km);

String? _kmRangeError(double? km) {
  if (km == null || !km.isFinite) return 'Enter a number of km';
  if (km < 0) return 'Cannot be negative';
  if (km > AppConstants.maxOdometerKm) return 'That looks too large';
  return null;
}
