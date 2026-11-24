import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/core/database/app_database.dart';
import 'package:ride_doctor/core/database/database_providers.dart';
import 'package:ride_doctor/core/database/storage/app_storage.dart';

import '../helpers/pump_app.dart';
import '../helpers/tap_targets.dart';

/// Stands in for the browser's in-memory storage. The real one cannot be
/// loaded in these tests (it needs WebAssembly); what matters here is how the
/// app behaves when storage says "nothing is kept".
final class _NothingKept implements AppStorage {
  const new();

  @override
  bool get persists => false;

  @override
  Future<AppDatabase> open() => throw UnimplementedError();

  @override
  Future<void> destroy() async {}
}

final _asPreview = <Override>[
  appStorageProvider.overrideWithValue(const _NothingKept()),
];

const _banner =
    'Web preview. Nothing is saved: reloading the page starts over.';

void main() {
  testWidgets('the phone app shows no preview strip', (tester) async {
    await pumpApp(tester);

    expect(find.text(_banner), findsNothing);
  });

  testWidgets('the preview says on every screen that nothing is saved', (
    tester,
  ) async {
    await pumpApp(tester, overrides: _asPreview);
    expect(find.text(_banner), findsOneWidget);

    await tester.tap(find.byIcon(Icons.speed_outlined));
    await tester.pumpAndSettle();
    expect(find.text(_banner), findsOneWidget);

    await tester.tap(find.byIcon(Icons.flag_outlined));
    await tester.pumpAndSettle();
    await tapText(tester, 'Add a race');
    expect(find.text(_banner), findsOneWidget);
  });

  testWidgets('the preview never claims the data is stored encrypted', (
    tester,
  ) async {
    await pumpApp(tester, overrides: _asPreview);
    await tester.tap(find.byIcon(Icons.settings_outlined));
    await tester.pumpAndSettle();
    await tapText(tester, 'Privacy and your data');

    expect(find.textContaining('This is a web preview.'), findsOneWidget);
    expect(
      find.text(
        'Everything is stored encrypted on this phone. Nothing is sent '
        'anywhere.',
      ),
      findsNothing,
    );
  });

  testWidgets('the phone app does make that promise', (tester) async {
    await pumpApp(tester);
    await tester.tap(find.byIcon(Icons.settings_outlined));
    await tester.pumpAndSettle();
    await tapText(tester, 'Privacy and your data');

    expect(
      find.text(
        'Everything is stored encrypted on this phone. Nothing is sent '
        'anywhere.',
      ),
      findsOneWidget,
    );
    expect(find.textContaining('This is a web preview.'), findsNothing);
  });

  for (final locale in const [Locale('en'), Locale('fil')]) {
    testWidgets('the strip fits at 200% text on a narrow phone, and leaves '
        'tap targets intact ($locale)', (tester) async {
      final semantics = tester.ensureSemantics();
      await pumpApp(
        tester,
        size: const Size(320, 9000),
        textScale: 2,
        deviceLocales: [locale],
        overrides: _asPreview,
      );
      expect(undersizedTapTargets(tester), isEmpty);
      semantics.dispose();
    });
  }
}
