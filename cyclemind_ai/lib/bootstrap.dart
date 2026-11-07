import 'package:cyclemind_ai/core/constants/app_constants.dart';
import 'package:cyclemind_ai/firebase_options.dart';
import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

/// One-time startup wiring, kept out of `main` for testability.
///
/// Firebase initialisation is *guarded*: in mock mode (the default) we skip it
/// entirely so the app boots with zero configuration. With `USE_MOCKS=false`
/// it initialises Firebase from the generated [DefaultFirebaseOptions]; any
/// failure is swallowed so a missing config never hard-crashes a dev build.
Future<void> bootstrap() async {
  if (AppConstants.useMocks) {
    debugPrint('CycleMind AI booting in MOCK mode (no Firebase/Claude keys).');
    return;
  }
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );

    // App Check must be activated before anything calls getToken(). The Cloud
    // Functions default to REQUIRE_APP_CHECK=true, so without this every AI
    // request is rejected with 401 "Missing App Check token".
    //
    // Debug providers are used in debug builds so a developer machine still
    // works; register the printed debug token in the Firebase console. Release
    // builds use the platform attestation providers.
    await FirebaseAppCheck.instance.activate(
      androidProvider:
          kDebugMode ? AndroidProvider.debug : AndroidProvider.playIntegrity,
      appleProvider:
          kDebugMode ? AppleProvider.debug : AppleProvider.appAttest,
    );
  } catch (e) {
    debugPrint('Firebase init failed (continuing): $e');
  }
}
