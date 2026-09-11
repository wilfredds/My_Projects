import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cyclemind_ai/features/rides/domain/entities/ride.dart';

/// Firestore mapping for [Ride] — the `rides/{rideId}` document.
class RideModel {
  const RideModel._();

  static Ride fromMap(String id, Map<String, dynamic> map) {
    return Ride(
      id: id,
      userId: map['userId'] as String? ?? '',
      bikeId: map['bikeId'] as String?,
      title: map['title'] as String? ?? 'Ride',
      startedAt: (map['startedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      distanceKm: (map['distance'] as num?)?.toDouble() ?? 0,
      elevationM: (map['elevation'] as num?)?.toDouble() ?? 0,
      avgSpeedKmh: (map['avgSpeed'] as num?)?.toDouble() ?? 0,
      durationSec: (map['durationSec'] as num?)?.toInt() ?? 0,
      calories: (map['calories'] as num?)?.toInt() ?? 0,
      cadence: (map['cadence'] as num?)?.toInt(),
      heartRate: (map['heartRate'] as num?)?.toInt(),
      power: (map['power'] as num?)?.toInt(),
    );
  }

  static Map<String, dynamic> toMap(Ride ride) => {
        'userId': ride.userId,
        'bikeId': ride.bikeId,
        'title': ride.title,
        'startedAt': Timestamp.fromDate(ride.startedAt),
        'distance': ride.distanceKm,
        'elevation': ride.elevationM,
        'avgSpeed': ride.avgSpeedKmh,
        'durationSec': ride.durationSec,
        'calories': ride.calories,
        'cadence': ride.cadence,
        'heartRate': ride.heartRate,
        'power': ride.power,
      };
}
