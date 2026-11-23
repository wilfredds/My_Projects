import 'package:freezed_annotation/freezed_annotation.dart';

part 'bike.freezed.dart';

enum BikeType { road, gravel, mtb, hybrid, converted }

enum PedalType { flat, clipless }

enum SensorKind {
  hrStrap,
  cadence,
  speed,
  powerMeter,
  bikeComputer,
  smartwatch,
}

@freezed
abstract class Drivetrain with _$Drivetrain {
  const factory({
    /// Front chainring tooth counts, e.g. [34, 50].
    required List<int> chainrings,

    /// Rear cog tooth counts, smallest first.
    required List<int> cogs,

    /// False while [cogs] is our estimate from the cassette's range rather
    /// than something the rider checked. Results built on it are Rough.
    required bool cogsConfirmed,
  }) = _Drivetrain;
}

@freezed
abstract class Bike with _$Bike {
  const factory({
    required String id,
    required BikeType type,

    /// ETRTO rim size, e.g. 622 for a 700C wheel.
    int? beadSeatDiameterMm,
    int? tyreWidthMm,

    /// Wheel circumference measured by rolling the bike one wheel turn.
    double? rollOutMm,
    double? crankLengthMm,
    PedalType? pedals,

    /// Centre of the bottom bracket to the top of the saddle.
    double? saddleHeightMm,
    double? tyrePressureKpa,
    Drivetrain? drivetrain,
  }) = _Bike;
}

/// A tyre size the rider can pick by the name printed on the sidewall.
typedef TyreSize = ({String label, int beadSeatDiameterMm, int widthMm});

/// Common sizes, as (marketing name, ETRTO bead seat diameter, width). The
/// ETRTO numbers are also printed on the tyre, e.g. "25-622".
const List<TyreSize> commonTyreSizes = [
  (label: '700 x 23C', beadSeatDiameterMm: 622, widthMm: 23),
  (label: '700 x 25C', beadSeatDiameterMm: 622, widthMm: 25),
  (label: '700 x 28C', beadSeatDiameterMm: 622, widthMm: 28),
  (label: '700 x 32C', beadSeatDiameterMm: 622, widthMm: 32),
  (label: '700 x 35C', beadSeatDiameterMm: 622, widthMm: 35),
  (label: '700 x 38C', beadSeatDiameterMm: 622, widthMm: 38),
  (label: '700 x 40C', beadSeatDiameterMm: 622, widthMm: 40),
  (label: '700 x 45C', beadSeatDiameterMm: 622, widthMm: 45),
  (label: '650B x 47', beadSeatDiameterMm: 584, widthMm: 47),
  (label: '27.5 x 2.25', beadSeatDiameterMm: 584, widthMm: 57),
  (label: '29 x 2.25', beadSeatDiameterMm: 622, widthMm: 57),
  (label: '26 x 2.1', beadSeatDiameterMm: 559, widthMm: 53),
];
