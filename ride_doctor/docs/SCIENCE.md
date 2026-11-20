# The science behind Ride Doctor

Every number the app shows a rider comes from a formula or threshold recorded
here, with its source and its limits. If it is not in this file, it must not be
in the app.

**Nothing is implemented yet.** Phase 0 contains no calculations. Formulas are
added here in the same commit as their code and tests, starting in Phase 1.

## Rules for this document

1. **No invented citations.** A source is listed only after someone has opened
   it and confirmed it says what we claim. Until then the entry carries
   `TODO(verify)` and the app must label the result accordingly.
2. Each entry states where the formula **stops being valid** (population it was
   derived from, input ranges, known error).
3. Constants live in `lib/core/science/constants.dart`, each with a comment
   pointing at its entry here.
4. Ride Doctor is an educational tool. Nothing here is medical advice.

## Confidence levels

Every calculated value carries one of these, shown to the rider as a chip.

| Level | Meaning | Example |
|---|---|---|
| Measured | Comes from a sensor or a test the rider performed | Max heart rate from a field test |
| Estimated | Comes from a published formula applied to known inputs | Max heart rate from age |
| Rough | Formula applied to weak, default or assumed inputs | Climbing speed from a guessed effort level |

A result is only as good as its weakest input: combining a Measured input with
a Rough one gives a Rough result.

## Entry template

```
### <id> <name>
Formula:      <in plain words, then symbols>
Inputs:       <name, unit, valid range>
Output:       <name, unit>
Confidence:   <which level, and what would raise it>
Source:       <full reference> — verified on <date> by <who> | TODO(verify)
Limits:       <where it breaks down>
Tests:        <test file and the reference values used>
```

## Planned entries

From PROMPT.md section 7. Status of all: **not implemented, sources not yet
verified.**

| Id | Topic | Phase |
|---|---|---|
| 7.1 | Age from birth year | 1 |
| 7.2 | Maximum heart rate (measured, else age-based estimate) | 1 |
| 7.3 | Heart-rate zones (LTHR, heart-rate reserve, % of max) | 1 |
| 7.4 | Power zones and W/kg | 1 |
| 7.5 | Saddle-height starting point | 1 |
| 7.6 | Wheel circumference | 1 |
| 7.7 | Gearing: ratio, development, cadence ↔ speed | 1 |
| 7.8 | Climb predictor (power balance) | 1 |
| 7.10 | Heat index and PAGASA heat categories | 1 |
| 7.9 | Training load (session RPE) | 3 |
| 7.11 | Hydration and sweat rate | 3 |
| 7.12 | Fuelling by duration | 3 |
| 7.13 | Taper | 2 |

The heat-category **colours** already exist in the theme
(`lib/app/theme/heat_risk_colors.dart`) as a design decision; the category
**thresholds** are not implemented and remain to be verified against PAGASA's
published table.
