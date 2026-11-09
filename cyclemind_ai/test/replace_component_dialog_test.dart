import 'dart:async';

import 'package:cyclemind_ai/core/error/failures.dart';
import 'package:cyclemind_ai/core/utils/result.dart';
import 'package:cyclemind_ai/core/utils/write_ack.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/maintenance_log.dart';
import 'package:cyclemind_ai/features/bikes/domain/repositories/bikes_repository.dart';
import 'package:cyclemind_ai/features/bikes/presentation/controllers/bikes_providers.dart';
import 'package:cyclemind_ai/features/bikes/presentation/widgets/replace_component_dialog.dart';
import 'package:cyclemind_ai/features/rides/presentation/controllers/rides_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

// The UI half of retry safety. The rules deny a repeated log id, but that
// only protects us if the dialog actually re-sends the SAME id, and never
// sends two for one tap.

/// Saves stay pending until the test resolves them, so the dialog can be
/// poked mid-save.
class _GatedBikes implements BikesRepository {
  final List<MaintenanceLog> attempts = [];
  final List<Completer<Result<WriteAck>>> _pending = [];

  void resolveNext(Result<WriteAck> result) =>
      _pending.removeAt(0).complete(result);

  @override
  Future<Result<WriteAck>> replaceComponent({
    required Bike bike,
    required BikeComponent replacement,
    required MaintenanceLog log,
  }) {
    attempts.add(log);
    final c = Completer<Result<WriteAck>>();
    _pending.add(c);
    return c.future;
  }

  @override
  Stream<List<Bike>> watchBikes(String userId) => const Stream.empty();
  @override
  Future<Result<WriteAck>> addBike(Bike bike) async =>
      const Success(WriteAck.confirmed);
  @override
  Future<Result<WriteAck>> setComponents(
          String bikeId, List<BikeComponent> components) async =>
      const Success(WriteAck.confirmed);
  @override
  Future<Result<void>> deleteBike(String bikeId) async => const Success(null);
  @override
  Stream<List<MaintenanceLog>> watchLogs(String userId, String bikeId) =>
      const Stream.empty();
}

const _roadie = Bike(
  id: 'b1',
  userId: 'u1',
  name: 'Roadie',
  frame: 'f',
  groupset: 'g',
  tires: 't',
  totalMileageKm: 4262,
  components: [
    BikeComponent(
      id: 'c1',
      type: 'Chain',
      brand: 'Shimano',
      installedAtKm: 1850,
      lifespanKm: 3000,
    ),
  ],
);

final _confirm = find.byKey(const Key('replace-confirm'));

/// Pumps a screen with the bike loaded, then opens "Mark replaced" on c1.
Future<_GatedBikes> _openDialog(WidgetTester tester) async {
  final repo = _GatedBikes();
  await tester.pumpWidget(ProviderScope(
    overrides: [
      bikesRepositoryProvider.overrideWithValue(repo),
      bikesStreamProvider.overrideWith((ref) => Stream.value([_roadie])),
      currentUserIdProvider.overrideWithValue('u1'),
    ],
    child: MaterialApp(
      home: Scaffold(
        body: Consumer(
          builder: (context, ref, _) {
            // Watching subscribes the stream, so the bike is loaded before
            // the dialog reads it.
            final loaded = ref.watch(bikesStreamProvider).hasValue;
            return TextButton(
              onPressed: loaded
                  ? () => markReplaced(context, bikeId: 'b1', componentId: 'c1')
                  : null,
              child: const Text('open'),
            );
          },
        ),
      ),
    ),
  ));
  await tester.pump(); // deliver the stream's first value
  await tester.tap(find.text('open'));
  await tester.pump(); // push the dialog route
  await tester.pump(const Duration(milliseconds: 300)); // finish its entrance
  expect(_confirm, findsOneWidget);
  return repo;
}

void main() {
  // pump(), never pumpAndSettle(): the save spinner animates forever.

  testWidgets('a double tap sends ONE write', (tester) async {
    final repo = await _openDialog(tester);

    // Two taps inside one frame, before the rebuild that disables the button:
    // only the synchronous _saving guard can stop the second.
    await tester.tap(_confirm);
    await tester.tap(_confirm);
    await tester.pump();

    expect(repo.attempts, hasLength(1));
  });

  testWidgets('after a failure the dialog stays open, and Try again reuses the '
      'SAME replacement id', (tester) async {
    final repo = await _openDialog(tester);

    await tester.tap(_confirm);
    await tester.pump();
    repo.resolveNext(
        Failure(const ServerFailure('Could not record the replacement.')));
    await tester.pump(); // run the save's continuation
    await tester.pump(); // render the error state it set

    expect(find.text('Could not record the replacement.'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);

    await tester.tap(_confirm);
    await tester.pump();

    expect(repo.attempts, hasLength(2));
    expect(repo.attempts[1].id, repo.attempts[0].id);
  });

  testWidgets('saved offline: the dialog closes, and the snackbar says it will '
      'sync', (tester) async {
    final repo = await _openDialog(tester);

    await tester.tap(_confirm);
    await tester.pump();
    repo.resolveNext(const Success(WriteAck.queued));
    await tester.pump(); // run the save's continuation
    await tester.pump(); // pop, show the snackbar
    await tester.pump(const Duration(milliseconds: 400)); // animations

    expect(_confirm, findsNothing);
    expect(find.textContaining(savedOfflineNote), findsOneWidget);

    // Let the snackbar time out so no timer outlives the test.
    await tester.pump(const Duration(seconds: 5));
    await tester.pump(const Duration(seconds: 1));
  });
}
