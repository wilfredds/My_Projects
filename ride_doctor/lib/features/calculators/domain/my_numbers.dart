import 'package:meta/meta.dart';
import 'package:ride_doctor/core/science/bike_fit.dart';
import 'package:ride_doctor/core/science/explained.dart';
import 'package:ride_doctor/core/science/heart_rate.dart';
import 'package:ride_doctor/core/science/power.dart';
import 'package:ride_doctor/core/science/zones.dart';
import 'package:ride_doctor/features/profile/domain/bike.dart';
import 'package:ride_doctor/features/profile/domain/rider_profile.dart';

/// Every personal number the app can work out from what it currently knows.
///
/// A null field means "not enough information yet" - the screen turns each
/// null into a prompt that says exactly what to add (progressive profiling).
@immutable
final class MyNumbers {
  const new({
    required this.ageYears,
    required this.maxHr,
    required this.hrZones,
    this.powerZones,
    this.wattsPerKg,
    this.saddleHeightStart,
    this.saddleHeightDifferenceMm,
    this.wheelCircumference,
    this.drivetrain,
  });

  final int ageYears;
  final Explained<int> maxHr;
  final Explained<List<Zone>> hrZones;

  /// Needs FTP.
  final Explained<List<Zone>>? powerZones;
  final Explained<double>? wattsPerKg;

  /// Needs inseam.
  final Explained<double>? saddleHeightStart;

  /// Current saddle height minus the starting point: positive means the
  /// saddle is higher than the formula suggests. Needs inseam and the current
  /// saddle height. A difference is information, not a verdict.
  final double? saddleHeightDifferenceMm;

  /// Needs the tyre size (or a roll-out measurement).
  final Explained<double>? wheelCircumference;

  /// Needs chainrings and cogs.
  final Drivetrain? drivetrain;

  /// True when gear and climb calculations are possible.
  bool get canCalculateGearing =>
      wheelCircumference != null && drivetrain != null;
}

/// Works out [MyNumbers] from the stored profile and bike.
///
/// A pure function - no database, no clock, no widgets - so the whole
/// "what can we show this rider?" logic is unit-tested directly.
MyNumbers buildMyNumbers({
  required RiderProfile profile,
  required Bike? bike,
  required int currentYear,
}) {
  final age = ageFromBirthYear(
    birthYear: profile.birthYear,
    currentYear: currentYear,
  );
  final maxHr = maxHeartRate(ageYears: age, measuredBpm: profile.maxHrBpm);
  // A resting HR at or above the maximum can only be a data-entry slip; fall
  // back to the simpler method rather than failing the whole screen.
  final resting = profile.restingHrBpm;
  final usableResting = resting != null && resting < maxHr.value
      ? resting
      : null;

  final ftp = profile.ftpWatts;
  final inseam = profile.inseamMm;
  final saddleStart = inseam == null
      ? null
      : saddleHeightStartMm(inseamMm: inseam);
  final currentSaddle = bike?.saddleHeightMm;

  final bsd = bike?.beadSeatDiameterMm;
  final width = bike?.tyreWidthMm;
  final rollOut = bike?.rollOutMm;
  final drivetrain = bike?.drivetrain;

  return MyNumbers(
    ageYears: age,
    maxHr: maxHr,
    hrZones: heartRateZones(
      maxHr: maxHr,
      restingBpm: usableResting,
      lthrBpm: profile.lthrBpm,
    ),
    powerZones: ftp == null ? null : powerZones(ftpWatts: ftp),
    wattsPerKg: ftp == null
        ? null
        : wattsPerKg(ftpWatts: ftp, massKg: profile.weightKg),
    saddleHeightStart: saddleStart,
    saddleHeightDifferenceMm: saddleStart == null || currentSaddle == null
        ? null
        : currentSaddle - saddleStart.value,
    wheelCircumference: rollOut != null || (bsd != null && width != null)
        ? wheelCircumferenceMm(
            beadSeatDiameterMm: bsd ?? 0,
            tyreWidthMm: width ?? 0,
            measuredRollOutMm: rollOut,
          )
        : null,
    drivetrain:
        drivetrain != null &&
            drivetrain.chainrings.isNotEmpty &&
            drivetrain.cogs.isNotEmpty
        ? drivetrain
        : null,
  );
}
