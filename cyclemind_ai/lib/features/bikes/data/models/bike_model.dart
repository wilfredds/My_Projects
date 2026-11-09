import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';

/// Firestore mapping for [Bike] / [BikeComponent] — `bikes/{bikeId}`.
class BikeModel {
  const BikeModel._();

  static Bike fromMap(String id, Map<String, dynamic> map) {
    return Bike(
      id: id,
      userId: map['userId'] as String? ?? '',
      name: map['name'] as String? ?? 'Bike',
      frame: map['frame'] as String? ?? '',
      groupset: map['groupset'] as String? ?? '',
      tires: map['tires'] as String? ?? '',
      totalMileageKm: (map['totalMileageKm'] as num?)?.toDouble() ?? 0,
      imageUrl: map['imageUrl'] as String?,
      components: ((map['components'] as List?) ?? const [])
          .map((c) => _componentFromMap(c as Map<String, dynamic>))
          .toList(),
    );
  }

  static Map<String, dynamic> toMap(Bike bike) => {
        'userId': bike.userId,
        'name': bike.name,
        'frame': bike.frame,
        'groupset': bike.groupset,
        'tires': bike.tires,
        'totalMileageKm': bike.totalMileageKm,
        'imageUrl': bike.imageUrl,
        'components': bike.components.map(_componentToMap).toList(),
      };

  /// Components only, for a field-scoped update that must not touch
  /// `totalMileageKm`.
  static List<Map<String, dynamic>> componentsToMaps(
          List<BikeComponent> components) =>
      components.map(_componentToMap).toList();

  static BikeComponent _componentFromMap(Map<String, dynamic> c) =>
      BikeComponent(
        id: c['id'] as String? ?? '',
        type: c['type'] as String? ?? '',
        brand: c['brand'] as String? ?? '',
        installedAtKm: (c['installedAtKm'] as num?)?.toDouble() ?? 0,
        lifespanKm: (c['lifespanKm'] as num?)?.toDouble() ?? 1,
      );

  static Map<String, dynamic> _componentToMap(BikeComponent c) => {
        'id': c.id,
        'type': c.type,
        'brand': c.brand,
        'installedAtKm': c.installedAtKm,
        'lifespanKm': c.lifespanKm,
      };
}
