# The science behind Ride Doctor

Every number the app shows a rider comes from a formula or threshold recorded
here, with its source and its limits. If it is not in this file, it must not be
in the app.

Ride Doctor is an educational tool. Nothing here is medical advice.

## Rules for this document

1. **No invented citations.** A source is listed as checked only after someone
   opened it and confirmed it says what we claim.
2. Each entry states where the formula **stops being valid**.
3. Constants live in `lib/core/science/constants.dart`; the citation the app
   shows the rider lives in `lib/core/science/sources.dart`. Both must agree
   with this file.
4. An entry changes in the same commit as its code and its tests.

## How sources were checked

One verification pass was done on **2026-11-23** by an automated research
agent using web search and fetch. Its network access was limited: PubMed, PMC,
sheldonbrown.com and raw GitHub files could be opened; the NOAA, PAGASA,
TrainingPeaks, Joe Friel and PAR-Q+ sites could **not**. Each entry below says
which of these applies:

| Status | Meaning | Shown in the app as |
|---|---|---|
| **Verified** | The source itself was opened and states the claim | "Source checked" |
| **Partly** | Only a secondary source was opened, or only part of the claim was confirmed | "Source partly checked" |
| **Unverified** | Nothing could be opened; the numbers match search-result summaries only | "Source not yet checked" |

"Verified" for a journal paper means its **abstract** was read. No full text
of a paywalled paper was opened.

## Confidence levels

Every calculated value carries one of these, shown to the rider as a chip.

| Level | Meaning | Example |
|---|---|---|
| Measured | From a sensor or a test the rider performed | Zones from a threshold test |
| Estimated | A published formula applied to inputs the rider gave | Max heart rate from age |
| Rough | A formula applied to weak, default or assumed inputs | Zones built on that age-based max |

A result is only as good as its weakest input (`Confidence.weakest`). These
assignments are **our own rules**, not from any source:

- Zones built on the *convention* bands (percent of max, heart-rate reserve)
  are never better than Estimated, because the bands were not measured on this
  rider; they drop to Rough when the maximum itself is an age estimate.
- The climb prediction is capped at Estimated even with measured inputs,
  because tyre and air-drag values are typical figures, not this rider's.
- Anything using cogs we estimated from a cassette's range is Rough.

---

## 7.1 Age

**Formula.** Current year minus birth year.

**Limits.** Up to one year high before the rider's birthday. We ask for the
year only (less personal than a date). For 7.2 that is 0.7 bpm, far inside
that formula's own uncertainty, so it does not lower any confidence.

**Source.** Arithmetic.

## 7.2 Maximum heart rate

**Formula.** The rider's measured value if they entered one (Measured).
Otherwise `HRmax = 208 − 0.7 × age`, rounded (Estimated).

**Source — Verified (abstract).** Tanaka H, Monahan KD, Seals DR.
Age-predicted maximal heart rate revisited. *J Am Coll Cardiol.*
2001;37(1):153-156. doi:10.1016/S0735-1097(00)01054-8. PMID 11153730. The
abstract states the equation, from a meta-analysis of 351 studies (18,712
subjects) cross-validated in 514 healthy subjects, with no difference between
men and women.

**Limits.** The population is healthy adults. The meta-analysis regressed
*group means*, so its correlation is not a measure of individual accuracy. The
abstract gives no individual error; we tell riders only that individual
variation is large, without quoting a number we have not seen. Not for anyone
on heart-rate-altering medication.

**Tests.** `test/core/science/heart_rate_test.dart`.

## 7.3 Heart-rate zones

Best available method first.

### a. Threshold zones (Friel) — Measured

**Formula.** Percent of lactate-threshold heart rate (LTHR): Z1 below 81%,
Z2 81–89%, Z3 90–93%, Z4 94–99%, Z5a 100–102%, Z5b 103–106%, Z5c above 106%.
Field test: 30 minutes hard, alone; LTHR is the average heart rate of the last
20 minutes.

**Source — Unverified.** Friel J. *The Cyclist's Training Bible.* VeloPress.
The table as published in "Joe Friel's Quick Guide to Setting Zones"
(TrainingPeaks). Neither page could be opened; the percentages match
search-result summaries of that article. **`TODO(verify)`**: open the article
and confirm the *cycling* table (its running table uses different numbers).

### b. Heart-rate reserve (Karvonen) — Estimated, or Rough on an estimated max

**Formula.** `target = resting + fraction × (max − resting)`, five zones with
lower bounds at 50, 60, 70, 80, 90%.

**Source — Partly.** The reserve method is attributed to Karvonen MJ, Kentala
E, Mustala O. The effects of training on heart rate; a longitudinal study.
*Ann Med Exp Biol Fenn.* 1957;35(3):307-315. PMID 13470504. The reference was
confirmed in PubMed, but it has no abstract, so the formula itself was not
seen in any opened source. The five 10%-wide bands are a **coaching
convention** with no single scientific source (see c).

### c. Percent of maximum — Estimated, or Rough on an estimated max

**Formula.** Five zones with lower bounds at 50, 60, 70, 80, 90% of HRmax.

**Source — Partly.** A convention. An opened review (Seiler-Viken et al., *Sci
Rep.* 2025;15:34367, doi:10.1038/s41598-025-17023-z) says intensity scales
came "primarily from coaches and athletes", crediting Sally Edwards' 1996
five-zone scale. The exact five bands were not seen in any opened source.

### Our boundary rules (all three)

Zones are whole beats and contiguous: each zone ends one beat below the next
one's start. Percentages are computed in **integer arithmetic**, rounding
halves up, because `0.9 × 145` in floating point lands a hair under 130.5 and
rounds the wrong way. Zone 5c starts one beat above the last beat within 106%.

**Tests.** `test/core/science/heart_rate_test.dart`, including contiguity for
every LTHR from 100 to 210.

## 7.4 Power zones and W/kg

**Formula.** Percent of FTP (Coggan): L1 up to 55%, L2 56–75%, L3 76–90%,
L4 91–105%, L5 106–120%, L6 121–150%, L7 above 150%. `W/kg = FTP / body mass`.
Measured, because FTP only exists if the rider tested it.

**Source — Unverified.** Allen H, Coggan A. *Training and Racing with a Power
Meter.* VeloPress; 2006, and Coggan's "Power Training Levels" (TrainingPeaks).
Not opened; only levels 1–3 were confirmed even at search-summary level.
**`TODO(verify)`**.

**Our choice.** The published table reads "below 55%" then "56–75%", leaving
exactly 55% unassigned. We put it in level 1: each level's upper bound is
inclusive and rounded down to a whole watt.

**Limits.** Depends on a recent FTP. Other systems derived from Coggan
(TrainerRoad, WKO "iLevels") use different bands; these are not interchangeable.

**Tests.** `test/core/science/power_test.dart`.

## 7.5 Saddle-height starting point

**Formula.** `0.883 × inseam`, from the centre of the bottom bracket to the
top of the saddle. Estimated.

**Source — Partly.** LeMond G, Gordis K. *Greg LeMond's Complete Book of
Bicycling.* Perigee; 1990 — not opened. Confirmed as described in an opened
paper: Conceição A, et al. *Int J Environ Res Public Health.* 2022;19(11):6590.
doi:10.3390/ijerph19116590: "multiplying the inseam measurement ... by 0.883 to
get the distance from the center of the bottom bracket to the top of the
seat." The phrase "along the seat tube" is ours, not the source's.

**Limits — this is why it is only a starting point.**
- Encarnación-Martínez A, Ferrer-Roca V, García-López J. *J Strength Cond
  Res.* 2021;35(2):519-526. doi:10.1519/JSC.0000000000002689: inseam-based
  protocols including LeMond's put only 20–33% of women and 47–60% of men in
  the recommended knee range; the equations are "male-based".
- Millour G, et al. *Sports Biomech.* 2021;20(4):391-406.
  doi:10.1080/14763141.2018.1556324: inseam methods "were designed for
  medium-sized people" and miss for short and long inseams.
- The literature is not even consistent on the number: one paper calls 85.5%
  "the LeMond method".

**Not implemented: knee angle.** The spec's static 25–35° knee flexion at the
bottom of the stroke is attributed to Holmes JC, Pruitt AL, Whalen NJ. *Clin
Sports Med.* 1994;13(1):187-205 (PMID 8111852). Its abstract does not mention
the angle; the figure was confirmed only as others quote it, and one review
(Bini et al., *Sports Med.* 2011) recommends a narrower 25–30°. The app does
not use a knee angle until Phase 6. **`TODO(verify)`** before then.

**The comparison shown to the rider** ("your saddle is N cm higher") is plain
subtraction. Differences under 3 mm are shown as "matches": our threshold, for
tape-measure precision. It is information, never a verdict.

**Tests.** `test/core/science/bike_fit_test.dart`.

## 7.6 Wheel circumference

**Formula.** `π × (bead seat diameter + 2 × tyre width)` in mm (Estimated). A
roll-out measurement, if entered, replaces it (Measured).

**Source — Verified.** Brown S, Allen JS. *Cyclecomputer Calibration.*
sheldonbrown.com/cyclecomputer-calibration.html. States the method with the
worked example 622 + 2×28 = 678, ×π = 2130 mm.

**Limits (same page).** "the actual rolling diameter will be about 1% smaller
for a road tire, and smaller yet at low inflation pressure"; chart or ETRTO
values are "generally ... accurate to within one or two percent". Its own
table lists 2105 mm for 25-622 where the formula gives 2111 mm. A roll-out
should be done with the rider on the bike.

**Tests.** `test/core/science/bike_fit_test.dart`.

## 7.7 Gearing

**Formula.** `ratio = chainring / cog`; `development = ratio × circumference`;
`cadence = speed (m/min) / development`; speed is the inverse.

**Source.** Arithmetic.

**Golden values (from the spec).** 39×28 on a 2.10 m wheel at 8 km/h → 45.6
rpm; 34×32 → 59.8 rpm.

**Cassette estimate — our own heuristic, Rough.** When the rider knows only
the range and number of cogs ("11-34, 10-speed"), the middle cogs are spaced
geometrically (constant percentage steps). The smallest and largest cogs are
exact; the middle ones are a guess and are flagged until the rider confirms.
No source; real cassettes differ.

**Tests.** `test/core/science/gearing_test.dart`.

## 7.8 Climb predictor

**Formula.** `P × η = v × [ m·g·(sin θ + Crr·cos θ) + ½·ρ·CdA·v² ]`, with
`θ = atan(grade)`. Solved for `v` by bisection (60 halvings), which cannot
diverge because required power rises monotonically with speed on a flat or
uphill road. Air density `ρ = p / (R × T)`.

**Source for the model — Verified (abstract).** Martin JC, Milliken DL, Cobb
JE, McFadden KL, Coggan AR. Validation of a mathematical model for road
cycling power. *J Appl Biomech.* 1998;14(3):276-291. doi:10.1123/jab.14.3.276.
Modelled and measured power agreed with R² = 0.97 and a standard error of
2.7 W. Our equation is a steady-state simplification: the full model also has
wheel-bearing friction and kinetic-energy terms. The same simplified form
appears as Eq. 3 in Horvath & Andersson, *Front Sports Act Living.*
2025;7:1599319.

**Default values.**

| Constant | Value | Status | Basis |
|---|---|---|---|
| Standard gravity `g` | 9.80665 m/s² | Verified | CODATA: "exact" |
| Gas constant, dry air `R` | 287.05 J/(kg·K) | Partly | Agrees with 287.047 (MetPy) and 287.0528 (ISO 2533, summary only) to 5 figures |
| Rolling resistance `Crr` | 0.005 | Partly | Horvath & Andersson 2025 use 0.005. Published range is wide: 0.0015–0.015 (Pivit, via sheldonbrown.com) |
| Drag area `CdA` | 0.35 m² | **Unverified** | No opened source gives a value for "on the hoods". Nearest: 0.39 m² for "a typical conventional racing bicycle" (Pivit). `TODO(verify)` |
| Drivetrain efficiency `η` | 0.97 | Partly | "typically assumed as 0.976" citing Martin 1998 (Knechtle et al. 2022); others use 0.95–0.98 |
| Air density default | 1.225 kg/m³ | — | Standard atmosphere at 15 °C; hot air is thinner (1.164 at 30 °C), which the model can take as an input |
| Bike + kit mass | 11 kg | **Our assumption** | No source |

**Effort → power — our own assumptions, no source.**
- With an FTP: easy, steady, hard = 65%, 80%, 95% of FTP (Estimated).
- Without: 1.5, 2.0, 2.5 W per kg of body mass (Rough).
These exist so a rider with no power meter still gets an answer.
**`TODO(verify)`** against a published W/kg table.

**Gear advice — our own thresholds, from the spec.** Recommend the gear
nearest 80 rpm (middle of a 70–90 rpm beginner band). "Grinding" means the
easiest gear turns below 60 rpm; the fix suggested is the smallest change
(larger cog, or smaller chainring) that reaches 75 rpm.

**Limits.** Steady effort, constant gradient, no wind, no drafting. On a steep
climb gravity dominates and the uncertain CdA matters little; on the flat it
dominates.

**Tests.** `test/core/science/climb_test.dart`: reference values worked
independently, plus round-trip (power → speed → power) across grades.

## 7.10 Heat index and heat category

**Formula.** The US National Weather Service algorithm, in °F:

1. At or below 40 °F: the heat index is the temperature.
2. Simple formula: `0.5 × (T + 61 + 1.2 × (T − 68) + 0.094 × RH)`. If that is
   79 or below, it is the answer.
3. Otherwise the Rothfusz regression:
   `−42.379 + 2.04901523·T + 10.14333127·RH − 0.22475541·T·RH − 0.00683783·T²
   − 0.05481717·RH² + 0.00122874·T²·RH + 0.00085282·T·RH² − 0.00000199·T²·RH²`
4. If RH ≤ 13% and 80 ≤ T ≤ 112: subtract `((13 − RH)/4) × √((17 − |T − 95|)/17)`.
   If RH > 85% and 80 ≤ T ≤ 87: add `((RH − 85)/10) × ((87 − T)/5)`.

**Source for the algorithm — Verified (published port), NOAA page not
opened.** Anderson GB, Bell ML, Peng RD. Methods to calculate the heat index
as an exposure metric in environmental health research. *Environ Health
Perspect.* 2013;121(10):1111-1119. doi:10.1289/ehp.1206273, and its code
(github.com/geanders/weathermetrics, `R/heat_index.R`), which the paper says
was converted from the NWS online calculator with permission. Our
implementation follows that code step for step. The NWS page itself
(wpc.ncep.noaa.gov/html/heatindex_equation.shtml) could not be opened.

**A correction made during this phase.** An earlier draft averaged the simple
formula with the temperature a second time and switched at 80, following a
reading of the NWS page's prose. The opened code averages once and switches
above 79. We follow the code. The two differ by under 1 °F and only near
80 °F; anything above about 81 °F is unchanged. **`TODO(verify)`** against the
NWS page.

**Chart values.** Not verified. The printed NWS chart could not be opened, so
tests compare against the algorithm worked independently, not against chart
cells.

**Heat categories (PAGASA) — Unverified.** Below 27 °C not hazardous; 27–32
caution; 33–41 extreme caution; 42–51 danger; 52 and above extreme danger.
PAGASA's own pages could not be opened. These bands match recent news reports
citing PAGASA; an older PAGASA page reportedly used different upper bands
(41–54 danger, above 54 extreme danger). **`TODO(verify)`** against PAGASA
directly before release. Whether PAGASA applies the NWS adjustments is not
established.

**Our rounding rule.** The bands are published in whole degrees, leaving 32.5
undefined; we round the heat index to the nearest whole degree before
classifying.

**Filipino category names** in the app are our translations. PAGASA's own
Filipino wording was not found; only "damang init" for heat index.

**Limits.** Anderson et al. note the underlying model is a person 1.7 m tall
and 67 kg, at rest-level metabolism, and that it "may not capture the
experience of certain subpopulations" — exertion raises heat load. That the
value assumes shade and a light wind is widely stated but was seen only in a
search summary. For a cyclist working hard in direct sun, real risk is
**higher** than the category shown. The ride advice text in the app is ours
(the "danger → early morning or indoors, extreme danger → do not ride
outdoors" rule is from the spec).

**Tests.** `test/core/science/heat_index_test.dart`.

---

## Readiness check (not PAR-Q+)

The spec asks for a "PAR-Q+ style" check. The app uses **seven questions of
our own wording** on the topics such screenings usually cover. It does not use
the PAR-Q+.

**Why.** The PAR-Q+ site could not be opened, but search summaries of its
terms say the form is the property of the PAR-Q+ Collaboration, must be used
whole and unchanged, needs a commercial licence for for-profit use, and "may
not be incorporated into electronic surveys, research tools, or any derivative
materials without the express written consent" of the Collaboration. That is
enough reason not to embed or adapt it. This is a description of what was
found, not legal advice.

**Status — needs review before release.** Our questions have not been reviewed
by a medical professional, and whether independently written questions on the
same topics raise any concern has not been checked. Any "yes" produces a
recommendation to see a doctor before hard training or racing; it never blocks
the app and is never a diagnosis.

---

## 7.13 Taper

**Rule.** With at least 8 weeks to a race the plan ends with a 14-day taper;
with 2 to under 8 weeks, a 7-day taper. The advice shown: ride about half the
usual volume and keep a few short hard efforts.

**Source — Verified (abstract).** Bosquet L, Montpetit J, Arvisais D, Mujika
I. Effects of tapering on performance: a meta-analysis. *Med Sci Sports
Exerc.* 2007;39(8):1358-1365. doi:10.1249/mss.0b013e31806010e0. PMID 17762369.
From 27 studies of competitive athletes: "A 2-wk taper during which training
volume is exponentially reduced by 41-60% seems to be the most efficient
strategy", "without any modification of either training intensity ... or
frequency".

**Limits and our choices.** The studies are of competitive athletes, not
beginners, and across several sports. The 7-day taper for shorter build-ups
is **our own shortening**, so that some time is left to build; the paper
supports two weeks. The app currently states the taper as advice; it does not
yet prescribe sessions (Phase 3).

**Tests.** `test/features/race_prep/countdown_test.dart`.

## Race prep: countdown modes and race-day timeline

These are **planning conventions from the product spec, not study results.**

**Countdown mode** (`countdown.dart`). 8 weeks or more: long build. 2 to under
8 weeks: compressed build. 2 to under 14 days: race week. Under 48 hours: race
day. After the start: race over. The boundaries are exact and tested on both
sides. The 28-day build block inside a long build is our own choice.

**Race-day timeline** (`race_day_timeline.dart`). Worked backward from the
start time, each step at the middle of the spec's range:

| Step | Minutes before the start | Spec range |
|---|---|---|
| Pre-race meal | 150 | 2–3 h before |
| Arrive | 75 | 60–90 min before |
| Register and pin number | 65 | — |
| Ride the course (if allowed) | 50 | — |
| Warm-up starts | 30 | 15–25 min long |
| Warm-up ends; last drink and toilet | 10 | 5–10 min before |
| Go to the line | 5 | — |

Wake-up is 30 minutes before the meal, or 45 minutes before leaving home if
that is earlier (a long drive). **`TODO(verify)`**: the meal timing against a
sports-nutrition source, when 7.12 (fuelling) is done in Phase 3.

**Skills and tactics library.** The 17 cards and their drills are **our own
wording** of conventional coaching advice, shaped by the list in the spec.
They cite no source and have not been reviewed by a qualified coach;
that review should happen before release. Drills were chosen to be done
alone, at low speed or on quiet roads.

**Debrief.** "Dizziness" is treated as a red flag: it always produces "please
see a doctor" and never training or bike-fit advice. The full red-flag list
from the spec (chest pain, fainting, unusual breathlessness, palpitations,
confusion in heat, sudden severe joint pain, swelling) arrives with the
diagnosis engine in Phase 4; the debrief offers only the symptoms above.

---

## Not yet implemented

| Id | Topic | Phase |
|---|---|---|
| 7.9 | Training load (session RPE) | 3 |
| 7.11 | Hydration and sweat rate | 3 |
| 7.12 | Fuelling by duration | 3 |

## Open verification list

Needs network access to the named site, or a person with the book:

1. Friel cycling LTHR table and test protocol (TrainingPeaks / the book).
2. Coggan power levels 4–7 and the 55% boundary (TrainingPeaks / the book).
3. NWS heat index page: the exact switch-over rule, and the chart cells.
4. PAGASA heat index bands, effect descriptions and Filipino wording.
5. PAR-Q+ terms page, read directly.
6. CdA for a rider on the hoods.
7. Holmes 1994 full text for the knee-angle range (before Phase 6).
8. A source for effort-to-W/kg defaults.
9. A qualified coach's review of the skills library and drills.
10. Pre-race meal timing against a sports-nutrition source.
