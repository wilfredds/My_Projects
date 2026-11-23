import 'package:ride_doctor/features/profile/domain/rider_profile.dart';

/// Stores the single rider profile. An interface so the UI and tests never
/// depend on how or where it is stored.
abstract interface class RiderRepository {
  /// Emits the profile now and again whenever it changes; null before
  /// onboarding has been completed.
  Stream<RiderProfile?> watchProfile();

  Future<void> saveProfile(RiderProfile profile);
}
