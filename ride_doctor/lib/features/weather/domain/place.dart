import 'package:meta/meta.dart';

/// The town the rider rides from, as chosen in a town search. Only this is
/// stored - never a GPS position - and its coordinates are already rounded
/// to about 11 km (see roundCoordinate).
@immutable
final class Place {
  const new({
    required this.name,
    required this.latitude,
    required this.longitude,
    this.region,
    this.countryCode,
    this.timezone,
  });

  final String name;
  final double latitude;
  final double longitude;

  /// Province, state or region, to tell towns with the same name apart.
  final String? region;

  /// Two-letter country code, e.g. "PH".
  final String? countryCode;

  /// IANA time zone, e.g. "Asia/Manila".
  final String? timezone;

  /// "Dasmariñas, Calabarzon, PH" - whichever parts are known.
  String get label => [name, ?region, ?countryCode].join(', ');

  @override
  bool operator ==(Object other) =>
      other is Place &&
      other.name == name &&
      other.latitude == latitude &&
      other.longitude == longitude &&
      other.region == region &&
      other.countryCode == countryCode &&
      other.timezone == timezone;

  @override
  int get hashCode =>
      Object.hash(name, latitude, longitude, region, countryCode, timezone);

  @override
  String toString() => 'Place($label @ $latitude,$longitude)';
}
