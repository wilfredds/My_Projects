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
