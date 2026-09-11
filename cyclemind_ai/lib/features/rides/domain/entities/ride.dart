import 'package:equatable/equatable.dart';

/// A single recorded ride. Maps to `rides/{rideId}`.
///
/// Optional sensor fields (cadence, heart rate, power) are nullable because not
/// every rider has the hardware — the AI coach degrades gracefully when they
/// are absent.
class Ride extends Equatable {
  const Ride({
    required this.id,
    required this.userId,
    required this.startedAt,
    required this.distanceKm,
    required this.elevationM,
    required this.avgSpeedKmh,
    required this.durationSec,
    required this.calories,
    this.bikeId,
    this.cadence,
    this.heartRate,
    this.power,
    this.title = 'Ride',
  });

  final String id;
  final String userId;
  final String? bikeId;
  final DateTime startedAt;
  final double distanceKm;
  final double elevationM;
  final double avgSpeedKmh;
  final int durationSec;
  final int calories;
  final int? cadence;
  final int? heartRate;
  final int? power;
  final String title;

  Duration get duration => Duration(seconds: durationSec);

  Ride copyWith({
    String? id,
    String? userId,
    String? bikeId,
    DateTime? startedAt,
    double? distanceKm,
    double? elevationM,
    double? avgSpeedKmh,
    int? durationSec,
    int? calories,
    int? cadence,
    int? heartRate,
    int? power,
    String? title,
  }) {
    return Ride(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      bikeId: bikeId ?? this.bikeId,
      startedAt: startedAt ?? this.startedAt,
      distanceKm: distanceKm ?? this.distanceKm,
      elevationM: elevationM ?? this.elevationM,
      avgSpeedKmh: avgSpeedKmh ?? this.avgSpeedKmh,
      durationSec: durationSec ?? this.durationSec,
      calories: calories ?? this.calories,
      cadence: cadence ?? this.cadence,
      heartRate: heartRate ?? this.heartRate,
      power: power ?? this.power,
      title: title ?? this.title,
    );
  }

  @override
  List<Object?> get props => [
        id,
        userId,
        bikeId,
        startedAt,
        distanceKm,
        elevationM,
        avgSpeedKmh,
        durationSec,
        calories,
        cadence,
        heartRate,
        power,
        title,
      ];
}
