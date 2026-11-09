/// App-wide constants and the runtime configuration flag.
class AppConstants {
  AppConstants._();

  static const String appName = 'CycleMind AI';

  /// Master switch between mock services and real Firebase/Claude.
  ///
  /// Architectural decision: external dependencies (Auth, Firestore, Storage,
  /// Claude, Vision) are selected at runtime from this compile-time flag. The
  /// default is `true`, so a fresh checkout runs fully offline on seeded mock
  /// data with zero configuration. Provide real keys and run with
  /// `--dart-define=USE_MOCKS=false` to switch to live backends.
  static const bool useMocks =
      bool.fromEnvironment('USE_MOCKS', defaultValue: true);

  /// Claude model id used by the (server-side) real AI implementation.
  /// Kept here for documentation; the key itself lives server-side only.
  static const String claudeModel = 'claude-sonnet-4-6';

  // Firestore collection names — single source of truth.
  static const String usersCollection = 'users';
  static const String bikesCollection = 'bikes';
  static const String ridesCollection = 'rides';
  static const String maintenanceLogsCollection = 'maintenance_logs';
  static const String aiReportsCollection = 'ai_reports';

  // Asset paths.
  static const String tipsAsset = 'assets/data/tips.json';
  static const String troubleshootingAsset = 'assets/data/troubleshooting.json';
  static const String mockSeedAsset = 'assets/data/mock_seed.json';

  /// Upper bound on a bike's odometer. Mirrored by `numIn(d.totalMileageKm,
  /// 0, 500000)` in firestore.rules and enforced by the mock, so the three
  /// cannot drift apart unnoticed.
  static const double maxOdometerKm = 500000;

  /// Upper bound on a single ride's distance. Mirrors `numIn(d.distance,
  /// 0, 2000)` in firestore.rules.
  static const double maxRideDistanceKm = 2000;

  /// Longest lifespan a component may be given. An app-level sanity bound:
  /// the rules cannot see inside `components[]`, so component_validation.dart
  /// is the only thing enforcing it.
  static const double maxComponentLifespanKm = 100000;

  /// Mirrors `d.components.size() <= 60` on bikes.
  static const int maxComponentsPerBike = 60;

  /// Input limit for a component's type and brand. App-level, and well inside
  /// [maxLogComponentChars], so a new part's label never needs clipping.
  static const int maxComponentTextChars = 40;

  /// Mirrors `str(d.component, 80)` on maintenance_logs.
  static const int maxLogComponentChars = 80;

  /// Mirrors `str(d.notes, 2000)` on maintenance_logs.
  static const int maxLogNotesChars = 2000;

  /// Longest note a rider can add to a replacement. Kept well under
  /// [maxLogNotesChars] so the generated summary always fits beside it.
  static const int maxServiceNoteChars = 1000;
}

/// Rider experience level.
enum RiderLevel { beginner, intermediate, advanced }

/// Training goals a user can pick.
enum RiderGoal { loseWeight, improveEndurance, prepareRace, firstHundredKm }

/// Risk levels returned by the Bike Doctor.
enum RiskLevel { low, medium, high }

/// AI report categories.
enum AiReportType { bikeHealth }

extension RiderLevelX on RiderLevel {
  String get label => switch (this) {
        RiderLevel.beginner => 'Beginner',
        RiderLevel.intermediate => 'Intermediate',
        RiderLevel.advanced => 'Advanced',
      };
}

extension RiderGoalX on RiderGoal {
  String get label => switch (this) {
        RiderGoal.loseWeight => 'Lose weight',
        RiderGoal.improveEndurance => 'Improve endurance',
        RiderGoal.prepareRace => 'Prepare for a race',
        RiderGoal.firstHundredKm => 'Complete first 100 km',
      };
}

extension RiskLevelX on RiskLevel {
  String get label => switch (this) {
        RiskLevel.low => 'Low',
        RiskLevel.medium => 'Medium',
        RiskLevel.high => 'High',
      };
}
