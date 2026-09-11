import 'dart:typed_data';

import 'package:cyclemind_ai/core/constants/app_constants.dart';
import 'package:cyclemind_ai/core/providers/firebase_providers.dart';
import 'package:cyclemind_ai/features/bike_doctor/data/repositories/firebase_reports_repository.dart';
import 'package:cyclemind_ai/features/bike_doctor/data/repositories/mock_reports_repository.dart';
import 'package:cyclemind_ai/features/bike_doctor/domain/entities/bike_health_report.dart';
import 'package:cyclemind_ai/features/bike_doctor/domain/repositories/reports_repository.dart';
import 'package:cyclemind_ai/features/bike_doctor/domain/usecases/analyze_bike_photo.dart';
import 'package:cyclemind_ai/features/rides/presentation/controllers/rides_providers.dart';
import 'package:cyclemind_ai/services/ai/ai_providers.dart';
import 'package:cyclemind_ai/services/vision/vision_service.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Binds the [ReportsRepository] implementation.
final reportsRepositoryProvider = Provider<ReportsRepository>((ref) {
  if (AppConstants.useMocks) return MockReportsRepository();
  return FirebaseReportsRepository(ref.watch(firestoreProvider));
});

/// Binds the [AnalyzeBikePhoto] use case (vision + persistence).
final analyzeBikePhotoProvider = Provider<AnalyzeBikePhoto>((ref) {
  return AnalyzeBikePhoto(
    ref.watch(visionServiceProvider),
    ref.watch(reportsRepositoryProvider),
  );
});

/// History of past Bike Doctor scans.
final reportsStreamProvider = StreamProvider<List<BikeHealthReport>>((ref) {
  final userId = ref.watch(currentUserIdProvider);
  if (userId.isEmpty) return const Stream.empty();
  return ref.watch(reportsRepositoryProvider).watchReports(userId);
});

/// Drives the scan screen: holds the latest analysis result + loading/error.
class BikeDoctorController extends StateNotifier<AsyncValue<BikeHealthReport?>> {
  BikeDoctorController(this._ref) : super(const AsyncData(null));
  final Ref _ref;

  Future<void> analyze({
    required Uint8List imageBytes,
    required BikePart part,
    String? bikeId,
  }) async {
    state = const AsyncLoading();
    final userId = _ref.read(currentUserIdProvider);
    final result = await _ref.read(analyzeBikePhotoProvider).call(
          imageBytes: imageBytes,
          part: part,
          userId: userId,
          bikeId: bikeId,
        );
    state = result.fold(
      (failure) => AsyncValue<BikeHealthReport?>.error(
          failure.message, StackTrace.current),
      (report) => AsyncValue<BikeHealthReport?>.data(report),
    );
  }

  void reset() => state = const AsyncData(null);
}

final bikeDoctorControllerProvider = StateNotifierProvider<BikeDoctorController,
    AsyncValue<BikeHealthReport?>>((ref) {
  return BikeDoctorController(ref);
});
