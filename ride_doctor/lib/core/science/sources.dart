import 'package:meta/meta.dart';
import 'package:ride_doctor/core/science/explained.dart';

/// How far a citation has actually been checked. The app shows this to the
/// rider, because "a source exists" and "someone read the source" are not the
/// same thing (docs/SCIENCE.md records what was opened, and when).
enum SourceStatus {
  /// The source was opened and states what we claim.
  verified,

  /// A secondary source was opened, or only part of the claim was confirmed.
  partly,

  /// Could not be opened yet. Treat the numbers as provisional.
  unverified,
}

@immutable
final class ScienceSource {
  const new(this.citation, this.status);

  final String citation;
  final SourceStatus status;
}

/// The source behind each formula, or null when it is plain arithmetic or the
/// rider's own measurement and needs none.
///
/// Citations are bibliographic data, not prose, so they are not translated.
ScienceSource? sourceFor(Formula formula) => switch (formula) {
  Formula.tanakaMaxHr => const ScienceSource(
    'Tanaka H, Monahan KD, Seals DR. Age-predicted maximal heart rate '
    'revisited. J Am Coll Cardiol. 2001;37(1):153-156. '
    'doi:10.1016/S0735-1097(00)01054-8',
    SourceStatus.verified,
  ),
  Formula.frielLthrZones => const ScienceSource(
    "Friel J. The Cyclist's Training Bible. VeloPress. Zone table as "
    "published in Joe Friel's Quick Guide to Setting Zones (TrainingPeaks).",
    SourceStatus.unverified,
  ),
  Formula.karvonenZones => const ScienceSource(
    'Heart-rate reserve method: Karvonen MJ, Kentala E, Mustala O. The '
    'effects of training on heart rate; a longitudinal study. Ann Med Exp '
    'Biol Fenn. 1957;35(3):307-315. The five 10% bands are a coaching '
    'convention with no single source.',
    SourceStatus.partly,
  ),
  Formula.percentMaxHrZones => const ScienceSource(
    'Five zones by percentage of maximum heart rate are a coaching '
    "convention (popularised by Edwards S. Sally Edwards' Heart Zone "
    'Training. Adams Media; 1996), not a single study.',
    SourceStatus.partly,
  ),
  Formula.cogganPowerZones => const ScienceSource(
    'Allen H, Coggan A. Training and Racing with a Power Meter. VeloPress; '
    '2006. Where exactly 55% of FTP falls is our choice: level 1.',
    SourceStatus.unverified,
  ),
  Formula.lemondSaddleHeight => const ScienceSource(
    "LeMond G, Gordis K. Greg LeMond's Complete Book of Bicycling. Perigee; "
    '1990, as described in Conceicao A, et al. Int J Environ Res Public '
    'Health. 2022;19(11):6590. doi:10.3390/ijerph19116590',
    SourceStatus.partly,
  ),
  Formula.etrtoCircumference => const ScienceSource(
    'Brown S, Allen JS. Cyclecomputer Calibration. '
    'sheldonbrown.com/cyclecomputer-calibration.html',
    SourceStatus.verified,
  ),
  Formula.climbPowerBalance => const ScienceSource(
    'Martin JC, Milliken DL, Cobb JE, McFadden KL, Coggan AR. Validation of '
    'a mathematical model for road cycling power. J Appl Biomech. '
    '1998;14(3):276-291. doi:10.1123/jab.14.3.276. Tyre and air-drag values '
    'are typical figures, not from this paper.',
    SourceStatus.partly,
  ),
  Formula.nwsHeatIndex => const ScienceSource(
    'Algorithm: Anderson GB, Bell ML, Peng RD. Methods to calculate the heat '
    'index as an exposure metric in environmental health research. Environ '
    'Health Perspect. 2013;121(10):1111-1119. doi:10.1289/ehp.1206273 '
    '(the US National Weather Service calculator). Categories: PAGASA heat '
    'index classification, not yet checked against PAGASA directly.',
    SourceStatus.partly,
  ),
  Formula.measuredMaxHr ||
  Formula.wattsPerKg ||
  Formula.measuredCircumference ||
  Formula.gearCadence => null,
};
