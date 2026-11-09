import 'package:cyclemind_ai/app/theme/app_theme.dart';
import 'package:cyclemind_ai/core/utils/result.dart';
import 'package:cyclemind_ai/core/utils/write_ack.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/maintenance_log.dart';
import 'package:cyclemind_ai/features/bikes/domain/repositories/bikes_repository.dart';
import 'package:cyclemind_ai/features/bikes/presentation/controllers/bikes_providers.dart';
import 'package:cyclemind_ai/features/bikes/presentation/screens/bike_detail_screen.dart';
import 'package:cyclemind_ai/features/rides/presentation/controllers/rides_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// Layout regression, found by driving the built app in a browser.
///
/// The app theme gives every FilledButton `minimumSize: Size.fromHeight(52)`,
/// which is an INFINITE minimum width. That's right for full-width form
/// buttons, but the louder "Mark replaced" button a DUE part gets sits in a
/// Row. There it swallowed the row, squeezed "2500 / 3000 km" to one
/// character per line, and pushed itself out of view: broken exactly when
/// the part needs replacing. These tests render under the REAL theme because
/// the default test theme hides the bug.
class _NoLogs implements BikesRepository {
  @override
  Stream<List<MaintenanceLog>> watchLogs(String userId, String bikeId) =>
      Stream.value(const []);
  @override
  Stream<List<Bike>> watchBikes(String userId) => const Stream.empty();
  @override
  Future<Result<WriteAck>> addBike(Bike bike) async =>
      const Success(WriteAck.confirmed);
  @override
  Future<Result<WriteAck>> setComponents(
          String bikeId, List<BikeComponent> components) async =>
      throw UnimplementedError();
  @override
  Future<Result<void>> deleteBike(String bikeId) async => const Success(null);
  @override
  Future<Result<WriteAck>> replaceComponent({
    required Bike bike,
    required BikeComponent replacement,
    required MaintenanceLog log,
  }) async =>
      const Success(WriteAck.confirmed);
}

Bike _bikeWithPartAt(double usedKm) => Bike(
      id: 'b1',
      userId: 'u1',
      name: 'Roadie',
      frame: 'f',
      groupset: 'g',
      tires: 't',
      totalMileageKm: 4200,
      components: [
        BikeComponent(
          id: 'c1',
          type: 'Cassette',
          brand: 'SRAM',
          installedAtKm: 4200 - usedKm,
          lifespanKm: 3000,
        ),
      ],
    );

Future<void> _pumpDetail(WidgetTester tester, Bike bike) async {
  // A phone-width surface, as in the browser run that found the bug.
  tester.view.physicalSize = const Size(412, 915);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(ProviderScope(
    overrides: [
      bikesRepositoryProvider.overrideWithValue(_NoLogs()),
      bikesStreamProvider.overrideWith((ref) => Stream.value([bike])),
      currentUserIdProvider.overrideWithValue('u1'),
    ],
    child: MaterialApp(
      theme: AppTheme.light,
      home: BikeDetailScreen(bike: bike),
    ),
  ));
  await tester.pump();
  await tester.pump();
}

void main() {
  for (final (state, usedKm) in [
    ('due soon', 2500.0),
    ('overdue', 3600.0),
    ('ok', 300.0),
  ]) {
    testWidgets('a $state part keeps its km readable and its action visible',
        (tester) async {
      final bike = _bikeWithPartAt(usedKm);
      await _pumpDetail(tester, bike);

      final km = find.text('${usedKm.toStringAsFixed(0)} / 3000 km');
      expect(km, findsOneWidget);
      // Squeezed, it was ONE glyph wide (about 12px) and stacked a character
      // per line. Width, not line count, is the font-independent signal: the
      // test font's glyphs are wider than real ones and may wrap a little.
      expect(tester.getSize(km).width, greaterThan(60));

      final action = find.text('Mark replaced');
      expect(action, findsOneWidget);
      final screen = Offset.zero & tester.view.physicalSize;
      expect(screen.contains(tester.getRect(action).center), isTrue,
          reason: 'the button must be on screen, not pushed out of the row');
    });
  }
}
