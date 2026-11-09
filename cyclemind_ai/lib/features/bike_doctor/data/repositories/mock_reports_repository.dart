import 'package:cyclemind_ai/core/providers/mock_store.dart';
import 'package:cyclemind_ai/core/utils/result.dart';
import 'package:cyclemind_ai/features/bike_doctor/domain/entities/bike_health_report.dart';
import 'package:cyclemind_ai/features/bike_doctor/domain/repositories/reports_repository.dart';

/// In-memory [ReportsRepository] over the shared [MockStore].
///
/// Reports live in the store rather than a private static list so they are
/// scoped by `userId` and cleared on sign-out, while still surviving provider
/// rebuilds. The previous static list leaked every user's scan history to the
/// next person who signed in on the device.
class MockReportsRepository implements ReportsRepository {
  List<BikeHealthReport> _reportsFor(String userId) =>
      MockStore.instance.reports.where((r) => r.userId == userId).toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

  @override
  Stream<List<BikeHealthReport>> watchReports(String userId) async* {
    await MockStore.instance.ensureLoaded();
    yield _reportsFor(userId);
    yield* MockStore.instance.changes.map((_) => _reportsFor(userId));
  }

  @override
  Future<Result<BikeHealthReport>> saveReport(BikeHealthReport report) async {
    await MockStore.instance.ensureLoaded();
    MockStore.instance.commit((s) => s.reports.add(report));
    return Success(report);
  }
}
