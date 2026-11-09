import 'dart:async';

import 'package:cyclemind_ai/core/error/failures.dart';
import 'package:cyclemind_ai/core/utils/result.dart';
import 'package:cyclemind_ai/core/utils/write_ack.dart';
import 'package:cyclemind_ai/features/auth/domain/entities/app_user.dart';
import 'package:cyclemind_ai/features/auth/presentation/controllers/auth_controller.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/maintenance_log.dart';
import 'package:cyclemind_ai/features/bikes/domain/repositories/bikes_repository.dart';
import 'package:cyclemind_ai/features/bikes/presentation/controllers/bikes_providers.dart';
import 'package:cyclemind_ai/features/bikes/presentation/screens/add_bike_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

// Offline, "Save bike" used to do nothing visible: the save waited for a
// server that wasn't there, and every extra tap queued ANOTHER bike under a
// new id. These pin the guard, the stable id, and the honest outcome.

/// Saves stay pending until the test resolves them.
class _GatedBikes implements BikesRepository {
  final List<Bike> attempts = [];
  final List<Completer<Result<WriteAck>>> _pending = [];

  void resolveNext(Result<WriteAck> result) =>
      _pending.removeAt(0).complete(result);

  @override
  Future<Result<WriteAck>> addBike(Bike bike) {
    attempts.add(bike);
    final c = Completer<Result<WriteAck>>();
    _pending.add(c);
    return c.future;
  }

  @override
  Stream<List<Bike>> watchBikes(String userId) => const Stream.empty();
  @override
  Future<Result<WriteAck>> setComponents(
          String bikeId, List<BikeComponent> components) async =>
      const Success(WriteAck.confirmed);
  @override
  Future<Result<void>> deleteBike(String bikeId) async => const Success(null);
  @override
  Stream<List<MaintenanceLog>> watchLogs(String userId, String bikeId) =>
      const Stream.empty();
  @override
  Future<Result<WriteAck>> replaceComponent({
    required Bike bike,
    required BikeComponent replacement,
    required MaintenanceLog log,
  }) async =>
      const Success(WriteAck.confirmed);
}

const _rider = AppUser(
  id: 'u1',
  email: 'rider@example.com',
  profile: UserProfile(displayName: 'Rider'),
);

final _save = find.byKey(const Key('save-bike'));

Finder _field(String label) => find.widgetWithText(TextFormField, label);

/// Opens AddBikeScreen as a pushed route, as the app does.
Future<_GatedBikes> _openForm(WidgetTester tester) async {
  final repo = _GatedBikes();
  await tester.pumpWidget(ProviderScope(
    overrides: [
      bikesRepositoryProvider.overrideWithValue(repo),
      authStateProvider.overrideWith((ref) => Stream.value(_rider)),
    ],
    child: MaterialApp(
      home: Builder(
        builder: (context) => Scaffold(
          body: TextButton(
            onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const AddBikeScreen())),
            child: const Text('open'),
          ),
        ),
      ),
    ),
  ));
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
  await tester.enterText(_field('Name (e.g. Roadie)'), 'Gravel');
  return repo;
}

Future<void> _letSnackBarTimeOut(WidgetTester tester) async {
  await tester.pump(const Duration(seconds: 5));
  await tester.pump(const Duration(seconds: 1));
}

void main() {
  // pump(), never pumpAndSettle(), once saving: the spinner animates forever.

  testWidgets('a double tap sends ONE write', (tester) async {
    final repo = await _openForm(tester);

    await tester.tap(_save);
    await tester.tap(_save);
    await tester.pump();

    expect(repo.attempts, hasLength(1));
  });

  testWidgets('a failure keeps the form open, and the retry reuses the SAME '
      'bike id', (tester) async {
    final repo = await _openForm(tester);

    await tester.tap(_save);
    await tester.pump();
    repo.resolveNext(Failure(const ServerFailure('Could not save the bike.')));
    await tester.pump();
    await tester.pump();

    expect(find.byType(AddBikeScreen), findsOneWidget);
    expect(find.text('Could not save the bike.'), findsOneWidget);

    await tester.tap(_save);
    await tester.pump();

    expect(repo.attempts, hasLength(2));
    expect(repo.attempts[1].id, repo.attempts[0].id,
        reason: 'a new id per attempt is how duplicate bikes were queued');
    await _letSnackBarTimeOut(tester);
  });

  testWidgets('an impossible mileage is refused before any write',
      (tester) async {
    final repo = await _openForm(tester);

    await tester.enterText(_field('Current mileage (km)'), '-5');
    await tester.tap(_save);
    await tester.pump();

    expect(repo.attempts, isEmpty);
    expect(find.text('Cannot be negative'), findsOneWidget);
  });

  testWidgets('saved offline: the form closes and says it will sync',
      (tester) async {
    final repo = await _openForm(tester);

    await tester.tap(_save);
    await tester.pump();
    repo.resolveNext(const Success(WriteAck.queued));
    await tester.pump(); // run the save's continuation
    // Safe to settle now: the spinner went with the form. The page route
    // leaves the tree only on the frame AFTER its exit animation ends.
    await tester.pumpAndSettle();

    expect(find.byType(AddBikeScreen), findsNothing);
    expect(find.text('Gravel added. $savedOfflineNote'), findsOneWidget);
    await _letSnackBarTimeOut(tester);
  });
}
