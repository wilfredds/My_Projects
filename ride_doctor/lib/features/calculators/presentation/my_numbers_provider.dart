import 'package:ride_doctor/core/app/environment.dart';
import 'package:ride_doctor/features/calculators/domain/my_numbers.dart';
import 'package:ride_doctor/features/profile/data/profile_providers.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'my_numbers_provider.g.dart';

/// The rider's numbers, recalculated whenever the profile or bike changes.
/// Null until there is a profile.
@riverpod
MyNumbers? myNumbers(Ref ref) {
  final profile = ref.watch(riderProfileProvider).value;
  if (profile == null) return null;
  return buildMyNumbers(
    profile: profile,
    bike: ref.watch(bikeProvider).value,
    currentYear: ref.watch(clockProvider)().year,
  );
}
