import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/app/router/app_router.dart';

void main() {
  String? redirect(
    String location, {
    bool loading = false,
    bool failed = false,
    bool hasProfile = false,
  }) => redirectFor(
    location: location,
    loading: loading,
    failed: failed,
    hasProfile: hasProfile,
  );

  group('while the database is opening', () {
    test('everything goes to the starting screen', () {
      expect(redirect('/', loading: true), AppRoutes.starting);
      expect(redirect('/numbers', loading: true), AppRoutes.starting);
      expect(redirect('/onboarding', loading: true), AppRoutes.starting);
    });

    test('the starting screen stays put', () {
      expect(redirect(AppRoutes.starting, loading: true), isNull);
    });
  });

  group('when the database cannot be opened', () {
    test('everything goes to the error screen', () {
      expect(redirect('/', failed: true), AppRoutes.startupError);
      expect(redirect('/starting', failed: true), AppRoutes.startupError);
    });

    test('the error screen stays put', () {
      expect(redirect(AppRoutes.startupError, failed: true), isNull);
    });
  });

  group('first run (no profile)', () {
    test('everything goes to onboarding', () {
      expect(redirect('/'), AppRoutes.onboarding);
      expect(redirect('/numbers'), AppRoutes.onboarding);
      expect(redirect('/settings/privacy'), AppRoutes.onboarding);
      expect(redirect('/starting'), AppRoutes.onboarding);
    });

    test('onboarding stays put', () {
      expect(redirect(AppRoutes.onboarding), isNull);
    });
  });

  group('onboarded', () {
    test('the gate screens hand over to Today', () {
      expect(redirect('/starting', hasProfile: true), AppRoutes.today);
      expect(redirect('/onboarding', hasProfile: true), AppRoutes.today);
      expect(redirect('/startup-error', hasProfile: true), AppRoutes.today);
    });

    test('real destinations are left alone', () {
      for (final location in [
        AppRoutes.today,
        AppRoutes.numbers,
        AppRoutes.profile,
        AppRoutes.editBike,
        AppRoutes.privacy,
      ]) {
        expect(redirect(location, hasProfile: true), isNull);
      }
    });
  });
}
