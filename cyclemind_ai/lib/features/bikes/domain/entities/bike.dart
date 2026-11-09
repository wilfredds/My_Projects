import 'package:equatable/equatable.dart';

/// A bicycle owned by the user. Maps to `bikes/{bikeId}`.
///
/// Supports multiple bikes per user. Each tracks a list of [BikeComponent]s and
/// total mileage, which together drive maintenance reminders.
class Bike extends Equatable {
  const Bike({
    required this.id,
    required this.userId,
    required this.name,
    required this.frame,
    required this.groupset,
    required this.tires,
    this.totalMileageKm = 0,
    this.imageUrl,
    this.components = const [],
  });

  final String id;
  final String userId;
  final String name;
  final String frame;
  final String groupset;
  final String tires;
  final double totalMileageKm;
  final String? imageUrl;
  final List<BikeComponent> components;

  Bike copyWith({
    String? id,
    String? userId,
    String? name,
    String? frame,
    String? groupset,
    String? tires,
    double? totalMileageKm,
    String? imageUrl,
    List<BikeComponent>? components,
  }) {
    return Bike(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      name: name ?? this.name,
      frame: frame ?? this.frame,
      groupset: groupset ?? this.groupset,
      tires: tires ?? this.tires,
      totalMileageKm: totalMileageKm ?? this.totalMileageKm,
      imageUrl: imageUrl ?? this.imageUrl,
      components: components ?? this.components,
    );
  }

  @override
  List<Object?> get props => [
        id,
        userId,
        name,
        frame,
        groupset,
        tires,
        totalMileageKm,
        imageUrl,
        components,
      ];
}

/// The bike with [id] in [bikes], or null. A loop rather than `firstOrNull`,
/// which is not in dart:core.
Bike? bikeById(List<Bike> bikes, String id) {
  for (final b in bikes) {
    if (b.id == id) return b;
  }
  return null;
}

/// The component with [id] on [bike], or null.
BikeComponent? componentById(Bike bike, String id) {
  for (final c in bike.components) {
    if (c.id == id) return c;
  }
  return null;
}

/// [components] with the entry that shares [replacement]'s id swapped for it.
///
/// Order is preserved so the wear tiles don't jump around after a
/// replacement. An id that isn't in the list leaves it unchanged.
List<BikeComponent> replaceById(
  List<BikeComponent> components,
  BikeComponent replacement,
) =>
    [for (final c in components) c.id == replacement.id ? replacement : c];

/// A wear component with a lifespan, used to compute replacement reminders.
class BikeComponent extends Equatable {
  const BikeComponent({
    required this.id,
    required this.type,
    required this.brand,
    required this.installedAtKm,
    required this.lifespanKm,
  });

  /// A part fitted to a bike whose odometer reads [odometerKm], and which had
  /// already done [alreadyRiddenKm] before it went on.
  ///
  /// Without [alreadyRiddenKm], a half-worn chain added to a bike you already
  /// own read 0%, and its first reminder arrived a whole lifespan late.
  factory BikeComponent.fitted({
    required String id,
    required String type,
    required String brand,
    required double lifespanKm,
    required double odometerKm,
    double alreadyRiddenKm = 0,
  }) =>
      BikeComponent(
        id: id,
        type: type,
        brand: brand,
        installedAtKm: odometerKm - alreadyRiddenKm,
        lifespanKm: lifespanKm,
      );

  final String id;
  final String type; // e.g. Chain, Cassette, Tires, Brake Pads
  final String brand;

  /// The odometer reading at which this part had done zero km.
  ///
  /// It can be NEGATIVE: a part that arrived with more km than the bike has
  /// (a used chain on a new build) was "installed" before km 0. That is
  /// deliberate. Folding prior wear into this one number needs no new field,
  /// so it survives an older client, whose serialiser would silently drop a
  /// key it doesn't know on its next write.
  final double installedAtKm;
  final double lifespanKm;

  /// This slot with a brand-new part fitted at [odometerKm].
  ///
  /// The id and type are kept, so the slot keeps its place in the list and
  /// its service history; only the wear restarts.
  BikeComponent refitted({
    required double odometerKm,
    String? brand,
    double? lifespanKm,
  }) =>
      copyWith(installedAtKm: odometerKm, brand: brand, lifespanKm: lifespanKm);

  /// Distance ridden on this component given the bike's current odometer.
  double usedKm(double bikeTotalKm) =>
      (bikeTotalKm - installedAtKm).clamp(0, double.infinity);

  /// 0.0 (fresh) → 1.0+ (overdue) wear fraction.
  double wearFraction(double bikeTotalKm) =>
      lifespanKm <= 0 ? 0 : usedKm(bikeTotalKm) / lifespanKm;

  BikeComponent copyWith({
    String? id,
    String? type,
    String? brand,
    double? installedAtKm,
    double? lifespanKm,
  }) {
    return BikeComponent(
      id: id ?? this.id,
      type: type ?? this.type,
      brand: brand ?? this.brand,
      installedAtKm: installedAtKm ?? this.installedAtKm,
      lifespanKm: lifespanKm ?? this.lifespanKm,
    );
  }

  @override
  List<Object?> get props => [id, type, brand, installedAtKm, lifespanKm];
}
