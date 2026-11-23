import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path_provider_platform_interface/path_provider_platform_interface.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';
import 'package:ride_doctor/features/onboarding/presentation/onboarding_screen.dart';
import 'package:ride_doctor/main.dart' as app;

/// Points the app's "support directory" at a temporary folder.
final class _TempPathProvider extends PathProviderPlatform
    with MockPlatformInterfaceMixin {
  new(this.directory);

  final Directory directory;

  @override
  Future<String?> getApplicationSupportPath() async => directory.path;
}

void main() {
  // Every other test replaces the database with an in-memory one. This test
  // runs the real entry point against the real storage code: a real encrypted
  // file on disk, with only the two platform services (where files live, and
  // the keystore) stood in for. It is the closest thing to a device launch
  // that can run without a device.
  testWidgets('main() opens an encrypted database and starts onboarding', (
    tester,
  ) async {
    final directory = Directory.systemTemp.createTempSync('ride_doctor_main');
    addTearDown(() => directory.deleteSync(recursive: true));
    PathProviderPlatform.instance = _TempPathProvider(directory);
    FlutterSecureStorage.setMockInitialValues({});

    app.main();
    await tester.pumpAndSettle();

    expect(find.byType(OnboardingScreen), findsOneWidget);

    final file = File('${directory.path}/ride_doctor.db');
    expect(file.existsSync(), isTrue);
    expect(
      String.fromCharCodes(file.readAsBytesSync().take(15)),
      isNot('SQLite format 3'),
    );

    // Unmount so the database closes before the folder is deleted.
    await tester.pumpWidget(const SizedBox());
    await tester.pumpAndSettle();
  });
}
