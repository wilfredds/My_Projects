import 'package:drift/drift.dart';

/// Columns every row carries (PROMPT.md section 9): a UUID primary key and
/// two timestamps. UUIDs instead of auto-increment integers so that rows
/// created offline on two devices can never collide when sync arrives.
// Row classes are named ...Row so they never collide with the domain models
// of the same name (RiderProfile, Bike, ...).

mixin Audited on Table {
  TextColumn get id => text()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

/// One row: the single rider who uses this install.
@DataClassName('RiderProfileRow')
class RiderProfiles extends Table with Audited {
  TextColumn get displayName => text().withLength(min: 1, max: 40)();
  IntColumn get birthYear => integer()();
  TextColumn get sex => text().nullable()();
  RealColumn get heightCm => real()();
  RealColumn get weightKg => real()();
  RealColumn get inseamMm => real().nullable()();
  IntColumn get restingHrBpm => integer().nullable()();
  IntColumn get maxHrBpm => integer().nullable()();
  IntColumn get ftpWatts => integer().nullable()();
  IntColumn get lthrBpm => integer().nullable()();
  RealColumn get yearsRiding => real()();
  IntColumn get ridesPerWeek => integer()();
  IntColumn get typicalRideMinutes => integer()();
  RealColumn get hoursPerWeek => real()();
  TextColumn get goal => text()();
}

/// The answers to one pass through the readiness questions. A new row per
/// pass, so a rider who retakes it keeps their history.
@DataClassName('ReadinessScreeningRow')
class ReadinessScreenings extends Table with Audited {
  /// Which wording of the questions was answered.
  IntColumn get questionnaireVersion => integer()();

  /// JSON object: question name -> true/false.
  TextColumn get answersJson => text()();
  BoolColumn get anyYes => boolean()();
}

/// Append-only consent history: every grant or withdrawal is a new row, never
/// an update. The newest row per kind is the current state, and the older rows
/// are the evidence of what was agreed to and when.
@DataClassName('ConsentRecordRow')
class ConsentRecords extends Table with Audited {
  TextColumn get kind => text()();
  BoolColumn get granted => boolean()();

  /// Which version of the consent text the rider saw.
  IntColumn get policyVersion => integer()();
}

@DataClassName('BikeRow')
class Bikes extends Table with Audited {
  TextColumn get bikeType => text()();
  IntColumn get beadSeatDiameterMm => integer().nullable()();
  IntColumn get tyreWidthMm => integer().nullable()();
  RealColumn get rollOutMm => real().nullable()();
  RealColumn get crankLengthMm => real().nullable()();
  TextColumn get pedals => text().nullable()();
  RealColumn get saddleHeightMm => real().nullable()();
  RealColumn get tyrePressureKpa => real().nullable()();
}

@DataClassName('DrivetrainRow')
class Drivetrains extends Table with Audited {
  TextColumn get bikeId =>
      text().references(Bikes, #id, onDelete: KeyAction.cascade)();

  /// Tooth counts as comma-separated integers, e.g. "34,50".
  TextColumn get chainrings => text()();
  TextColumn get cogs => text()();

  /// False while the cog list is only our estimate from the cassette's range.
  BoolColumn get cogsConfirmed => boolean()();
}

/// One row per kind of sensor the rider owns.
@DataClassName('SensorRow')
class Sensors extends Table with Audited {
  TextColumn get kind => text().unique()();
}

/// One row: how the app looks and reads.
@DataClassName('AppSettingsRow')
class AppSettingsRows extends Table with Audited {
  @override
  String get tableName => 'app_settings';

  TextColumn get themeMode => text()();
  TextColumn get languageCode => text().nullable()();
  TextColumn get unitSystem => text()();
}

// --- Schema version 2: race prep -------------------------------------------

@DataClassName('RaceEventRow')
class RaceEvents extends Table with Audited {
  TextColumn get name => text().withLength(min: 1, max: 60)();
  TextColumn get raceType => text()();

  /// Start as wall-clock time at the race, "2027-03-14T06:30:00.000", with no
  /// time zone: a 6:30 start is 6:30 wherever the phone thinks it is.
  TextColumn get startsAtLocal => text()();
  TextColumn get location => text().nullable()();
  RealColumn get distanceKm => real().nullable()();
  IntColumn get durationMinutes => integer().nullable()();
  IntColumn get laps => integer().nullable()();
  RealColumn get lapLengthKm => real().nullable()();
  IntColumn get cornerCount => integer().nullable()();
  IntColumn get elevationGainM => integer().nullable()();
  TextColumn get category => text().nullable()();
  TextColumn get rulesNotes => text().nullable()();
  IntColumn get travelMinutes => integer().withDefault(const Constant(30))();
  BoolColumn get reconAllowed => boolean().withDefault(const Constant(true))();
}

/// One row per ticked-or-unticked checklist item for a race. An item with no
/// row is simply not ticked yet.
@DataClassName('RaceChecklistItemRow')
class RaceChecklistItems extends Table with Audited {
  TextColumn get raceId =>
      text().references(RaceEvents, #id, onDelete: KeyAction.cascade)();
  TextColumn get item => text()();
  BoolColumn get checked => boolean()();

  @override
  List<Set<Column<Object>>> get uniqueKeys => [
    {raceId, item},
  ];
}

/// At most one debrief per race.
@DataClassName('RaceDebriefRow')
class RaceDebriefs extends Table with Audited {
  TextColumn get raceId => text().unique().references(
    RaceEvents,
    #id,
    onDelete: KeyAction.cascade,
  )();
  BoolColumn get finished => boolean()();
  IntColumn get placing => integer().nullable()();
  IntColumn get fieldSize => integer().nullable()();
  TextColumn get droppedWhen => text()();

  /// Enum names, comma-separated.
  TextColumn get struggles => text()();
  TextColumn get symptoms => text()();
  TextColumn get wouldChange => text().nullable()();
}
