// Every constant used by the science layer, in one place, each pointing at its
// entry in docs/SCIENCE.md. Change a number here only together with that
// document and the tests.

/// Standard acceleration of gravity, m/s^2. SCIENCE.md 7.8.
const double standardGravity = 9.80665;

/// Specific gas constant of dry air, J/(kg.K). SCIENCE.md 7.8.
const double dryAirGasConstant = 287.05;

/// 0 degrees Celsius in kelvin.
const double zeroCelsiusInKelvin = 273.15;

/// Standard sea-level pressure, Pa. Default when no pressure is known.
const double standardPressurePa = 101325;

// --- 7.2 Maximum heart rate (Tanaka) ---------------------------------------
const double tanakaIntercept = 208;
const double tanakaSlopePerYear = 0.7;

// --- 7.3 Heart-rate zones ---------------------------------------------------
//
// Zone bounds are whole percentages held as integers. Multiplying a heart rate
// by 0.9 in floating point can land a hair under a whole number and round the
// wrong way; integer arithmetic cannot.

/// Lower bounds of the five zones, as a percentage of HRmax or of heart-rate
/// reserve. The top of zone 5 is 100%.
const List<int> fiveZoneLowerPercents = [50, 60, 70, 80, 90];

/// Friel cycling zones as a percentage of lactate-threshold heart rate: the
/// first percentage belonging to zones 2, 3, 4, 5a and 5b. Zone 1 is
/// everything below zone 2; zone 5c is everything above
/// [frielZone5bUpperPercent].
const List<int> frielLowerPercents = [81, 90, 94, 100, 103];
const int frielZone5bUpperPercent = 106;

// --- 7.4 Power zones (Coggan) ----------------------------------------------

/// Upper bounds (inclusive) of levels 1-6 as a percentage of FTP. Level 7 is
/// everything above the last one.
const List<int> cogganUpperPercents = [55, 75, 90, 105, 120, 150];

// --- 7.5 Saddle height ------------------------------------------------------
const double lemondInseamFactor = 0.883;

// --- 7.8 Climb predictor defaults ------------------------------------------

/// Rolling resistance coefficient, road tyre on asphalt.
const double defaultCrr = 0.005;

/// Drag area in m^2 for a rider on the brake hoods.
const double defaultCdA = 0.35;

/// Fraction of pedalling power that reaches the rear wheel.
const double defaultDrivetrainEfficiency = 0.97;

/// Mass of bike plus kit, bottles and shoes when the rider has not told us.
/// Our own assumption, not from a source - results using it are Rough.
const double defaultBikeAndKitKg = 11;

/// Cadence band that suits most beginners on a climb, rpm.
const double targetCadenceLowRpm = 70;
const double targetCadenceHighRpm = 90;

/// Below this cadence in the easiest gear, the rider is over-geared for the
/// climb ("grinding").
const double grindCadenceRpm = 60;

/// The cadence we aim for when suggesting easier gearing.
const double comfortableClimbCadenceRpm = 75;

// --- 7.10 Heat index (PAGASA categories, degrees C) -------------------------
const int pagasaCautionFromC = 27;
const int pagasaExtremeCautionFromC = 33;
const int pagasaDangerFromC = 42;
const int pagasaExtremeDangerFromC = 52;

// --- 7.8 Climbing effort -> power ------------------------------------------
//
// OUR OWN ASSUMPTIONS, not taken from a source (SCIENCE.md 7.8, "Effort").
// They exist so a rider with no power meter still gets an answer; anything
// built on the W/kg defaults is Rough.

/// Fraction of FTP a rider holds on a climb at each effort: easy, steady, hard.
const List<double> climbEffortFtpFractions = [0.65, 0.80, 0.95];

/// Climbing power per kg of body mass for a recreational rider with no FTP:
/// easy, steady, hard.
const List<double> climbEffortDefaultWattsPerKg = [1.5, 2.0, 2.5];

/// Air density of the standard atmosphere at sea level, 15 degrees C, kg/m^3.
const double standardAirDensity = 1.225;

// --- 7.9 Training load (docs/SCIENCE.md 7.9) --------------------------------

/// Top of the session effort scale (CR-10: 0 = rest, 10 = maximal).
const int effortScaleMax = 10;

/// "This week": the last 7 days, today included.
const int recentWindowDays = 7;

/// "Your usual week": the average of the 4 weeks (28 days) before this one.
/// Kept separate from the recent 7 days on purpose - a ratio whose bottom
/// includes its own top is partly comparing a week with itself.
const int usualWindowDays = 28;

/// A recent week bigger than this many usual weeks is flagged. A coaching
/// rule of thumb that comes from team-sport studies; see SCIENCE.md 7.9 for
/// why it only ever softens a day and never blocks one.
const double bigWeekRatio = 1.5;

/// A usual week smaller than this (about 30 easy minutes) is too small to
/// divide by: a short ride would read as several "usual weeks". Our own
/// threshold, not from a source (SCIENCE.md 7.9).
const int minUsualWeekLoad = 100;

// --- 7.11 Hydration (docs/SCIENCE.md 7.11) ---------------------------------

/// Body-mass loss during a ride above which drinking was probably too little
/// ("excessive (>2% body weight loss from water deficit) dehydration",
/// Sawka 2007). About performance, not a safety limit.
const double maxBodyMassLossPercent = 2;

/// One kilogram of body mass lost in a ride is taken as one litre of sweat.
/// Our assumption: no source we opened states it.
const double litresPerKgLost = 1;

/// Sweat rates above this are rare (about 2% of athletes, Baker 2017), so a
/// result above it more likely means a drink or toilet stop was not written
/// down. The app asks the rider to check; it does not reject the result.
const double unusualSweatRateLitresPerHour = 3;

// --- 7.12 Fuelling (docs/SCIENCE.md 7.12) ----------------------------------

/// Rides shorter than this usually need no food, only water.
const int fuelFromMinutes = 60;

/// Rides longer than this get the higher range.
const int longFuelFromMinutes = 150;

const int moderateCarbMinGramsPerHour = 30;
const int moderateCarbMaxGramsPerHour = 60;
const int highCarbMinGramsPerHour = 60;
const int highCarbMaxGramsPerHour = 90;
