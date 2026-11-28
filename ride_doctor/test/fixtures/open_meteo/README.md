# Open-Meteo responses used by the tests

Answers from the Open-Meteo API, kept byte for byte, as saved in the test
suites of two open-source clients. Neither repository says they are live
captures; their server-generated fields (generation times, resolved time
zones, recorded headers) suggest so, but that is our inference. They are used
because Open-Meteo's own
documentation samples are cut short and are not valid JSON, and this
development environment could not call the API itself (its shared daily
quota was used up, and the town-search host is blocked).

| File | Saved in | What it shows |
|---|---|---|
| `forecast_many_variables.json` | python-open-meteo (github.com/frenck/python-open-meteo), committed 2026-10-03 | All of the app's hourly variables among about 150 others; 3 hours; sunrise and sunset; `uv_index` with an empty unit string |
| `forecast_7day_temperature_only.json` | openmeteo for R (github.com/tpisel/openmeteo), recorded 2023-10-25 | 168 hours, temperature only, `timezone=auto` resolved to America/Sao_Paulo |
| `forecast_daily_nulls.json` | openmeteo for R | A daily array that is entirely null, and no hourly data |
| `geocoding_enschede.json` | python-open-meteo | Two matches; the second has no population or postcodes (fields with default values are left out) |
| `geocoding_paris.json` | openmeteo for R | Two towns with the same name in different countries |
| `geocoding_no_match.json` | openmeteo for R | No match: the `results` field is left out entirely |

None of them is the app's exact query, so no test claims to replay one.

The data are Open-Meteo's, licensed CC BY 4.0
(https://creativecommons.org/licenses/by/4.0/): weather data by
Open-Meteo.com; location data based on GeoNames. These are API output, not
code from those repositories; the repositories' own licences were not checked
from here.
