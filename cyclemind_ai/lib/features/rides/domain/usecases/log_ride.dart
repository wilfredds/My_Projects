import 'package:cyclemind_ai/core/constants/app_constants.dart';
import 'package:cyclemind_ai/core/error/failures.dart';
import 'package:cyclemind_ai/core/utils/result.dart';
import 'package:cyclemind_ai/core/utils/ride_metrics.dart';
import 'package:cyclemind_ai/core/utils/write_ack.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
import 'package:cyclemind_ai/features/bikes/domain/usecases/generate_reminders.dart';
import 'package:cyclemind_ai/features/rides/domain/entities/ride.dart';
import 'package:cyclemind_ai/features/rides/domain/repositories/rides_repository.dart';

/// What logging a ride actually did, so the UI can tell the truth.
///
/// The screen used to claim "component wear updated" unconditionally while
/// nothing was updated at all. Every field here exists so the message can be
/// specific instead of reassuring.
class RideLogged {
  const RideLogged({
    required this.ride,
    this.bikeName,
    this.odometerBeforeKm,
    this.odometerAfterKm,
    this.newlyDue = const [],
    this.queued = false,
  });

  final Ride ride;
  final String? bikeName;
  final double? odometerBeforeKm;
  final double? odometerAfterKm;

  /// Components that were OK before this ride and are not OK after it.
  ///
  /// A PREDICTION from the local snapshot: if another device logged a ride
  /// concurrently it can be slightly off. The bikes stream is the source of
  /// truth; this exists to make the moment of crossing visible.
  final List<MaintenanceReminder> newlyDue;

  /// Saved on this device only: no signal, so the server hasn't confirmed it
  /// yet. It syncs on reconnect, and the odometer has already moved locally.
  final bool queued;

  bool get odometerMoved => odometerAfterKm != null;
}

/// Logs a ride and advances its bike's odometer.
///
/// Single composition point, mirroring `AnalyzeBikePhoto`: validation and
/// derivation live here rather than in the screen, and the atomic write lives
/// in [RidesRepository]. It deliberately does NOT take a BikesRepository — the
/// odometer may only move as part of writing a ride, and a second mutator is
/// how double-counting gets introduced later.
class LogRide {
  const LogRide(this._rides);
  final RidesRepository _rides;

  Future<Result<RideLogged>> call({
    required String rideId,
    required String userId,
    required String title,
    required double distanceKm,
    required double elevationM,
    required int durationSec,
    Bike? bike,
    int? cadence,
    double? riderWeightKg,
    DateTime? startedAt,
  }) async {
    // Mirror the bounds in firestore.rules so a rejection is explained here
    // rather than surfacing as an opaque permission error.
    //
    // Every bound in rideShapeOk is checked here. A ride saved offline only
    // meets the rules when it syncs, and a rejection then would roll it back
    // on the device without a word.
    if (title.length > AppConstants.maxRideTitleChars) {
      return Failure(const ValidationFailure(
          'Keep the title under ${AppConstants.maxRideTitleChars} characters.'));
    }
    if (distanceKm <= 0) {
      return Failure(const ValidationFailure('Distance must be more than 0 km.'));
    }
    if (distanceKm > AppConstants.maxRideDistanceKm) {
      return Failure(const ValidationFailure('That distance looks too large.'));
    }
    if (durationSec <= 0) {
      return Failure(const ValidationFailure('Duration must be more than 0.'));
    }
    if (durationSec > AppConstants.maxRideDurationSec) {
      return Failure(const ValidationFailure(
          'That duration looks too long for one ride.'));
    }
    if (cadence != null && (cadence < 0 || cadence > AppConstants.maxCadenceRpm)) {
      return Failure(const ValidationFailure(
          'Cadence must be between 0 and ${AppConstants.maxCadenceRpm} rpm.'));
    }
    if (elevationM < -5000 || elevationM > 30000) {
      return Failure(const ValidationFailure('That elevation looks wrong.'));
    }

    final avgSpeedKmh = distanceKm / (durationSec / 3600);
    if (avgSpeedKmh > 150) {
      return Failure(ValidationFailure(
          'That works out to ${avgSpeedKmh.toStringAsFixed(0)} km/h — '
          'check the distance and duration.'));
    }

    final before = bike?.totalMileageKm;
    if (before != null && before + distanceKm > AppConstants.maxOdometerKm) {
      return Failure(const ValidationFailure(
          'That ride would push the bike\'s odometer out of range.'));
    }

    final calories = RideMetrics.estimateCalories(
      avgSpeedKmh: avgSpeedKmh,
      weightKg: riderWeightKg ?? 72,
      durationSec: durationSec,
    );
    if (calories > AppConstants.maxRideCalories) {
      return Failure(const ValidationFailure(
          'That works out to an implausible calorie count. Check the duration.'));
    }

    final ride = Ride(
      id: rideId,
      userId: userId,
      bikeId: bike?.id,
      title: title.isEmpty ? 'Ride' : title,
      startedAt: startedAt ?? DateTime.now(),
      distanceKm: distanceKm,
      elevationM: elevationM,
      avgSpeedKmh: avgSpeedKmh,
      durationSec: durationSec,
      calories: calories,
      cadence: cadence,
      // The one place the bike/delta pairing is decided.
      odometerDeltaKm: bike == null ? null : distanceKm,
    );

    final saved = await _rides.addRide(ride);
    return saved.fold(
      Failure<RideLogged>,
      (ack) => Success(RideLogged(
        ride: ride,
        queued: ack == WriteAck.queued,
        bikeName: bike?.name,
        odometerBeforeKm: before,
        odometerAfterKm: before == null ? null : before + distanceKm,
        newlyDue: bike == null ? const [] : _newlyDue(bike, distanceKm),
      )),
    );
  }

  /// Components that cross out of `ok` because of this ride. Pure, so the
  /// crossing is unit-testable without Flutter.
  List<MaintenanceReminder> _newlyDue(Bike bike, double distanceKm) {
    const generate = GenerateReminders();
    final beforeIds = generate.call([bike]).map((r) => r.component.id).toSet();
    final after = generate.call([
      bike.copyWith(totalMileageKm: bike.totalMileageKm + distanceKm),
    ]);
    return after.where((r) => !beforeIds.contains(r.component.id)).toList();
  }
}

/// Deletes a ride, crediting back exactly what it added.
class DeleteRide {
  const DeleteRide(this._rides);
  final RidesRepository _rides;

  Future<Result<WriteAck>> call(Ride ride) => _rides.deleteRide(ride);
}

/// Which bike to preselect on the ride form: last-used, else the only bike,
/// else none.
///
/// Never `bikes.first` — `FirebaseBikesRepository.watchBikes` has no orderBy,
/// so list order is by document id and would default to a different bike than
/// the mock does. [rides] must be newest-first, which both repositories
/// guarantee. Returns null with several bikes and no prior attribution, so a
/// multi-bike owner makes a deliberate choice instead of silently crediting
/// the wrong bike.
String? defaultBikeId(List<Bike> bikes, List<Ride> rides) {
  if (bikes.isEmpty) return null;
  final ids = bikes.map((b) => b.id).toSet();
  for (final r in rides) {
    final id = r.bikeId;
    if (id != null && ids.contains(id)) return id;
  }
  return bikes.length == 1 ? bikes.single.id : null;
}
