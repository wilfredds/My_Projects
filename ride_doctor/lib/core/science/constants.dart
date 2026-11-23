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
