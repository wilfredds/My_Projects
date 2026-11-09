# Where the route numbers come from

Checked **9 November 2026**. Every route in `routes.json` was re-measured from scratch; the earlier
figures were estimates, and several were wrong (see the table at the bottom).

## Method

- **Route line and distance.** Each ride is defined by named waypoints (start, via points, turnaround or
  finish) and routed on OpenStreetMap roads with the FOSSGIS OSRM bicycle router
  (`routing.openstreetmap.de/routed-bike`). Out-and-back rides are the outbound leg doubled; loops return
  to the start. La Trinidad uses the car profile because the Halsema Highway is missing from the bicycle
  graph; the road is the same.
- **Climbing.** Elevation is sampled every 50 m (100 m on rides over 60 km) from the Copernicus GLO-90
  elevation model via the Open-Meteo elevation API, smoothed with a 9-sample median and counted with an
  8 m hysteresis so model noise isn't counted as climbing. Cross-checks: Tagaytay measures +490 m against a
  504 m net climb; Kidapawan–Lake Agco +1,000 m against 988 m net. Expect roughly ±20% on rolling routes.
  Under 30 m is shown as "flat".
- **Difficulty.** Beginner: up to 30 km and 150 m of climbing. Intermediate: up to 60 km and 800 m.
  Advanced: anything more.
- **Moving time.** From 20 km/h + 600 m climbed per hour (fit) to 13 km/h + 300 m per hour (relaxed),
  rounded to the nearest 5 minutes or half hour. Stops are not included.
- **Route lines** in `route-shapes.json` are the same routed lines, simplified (8 m tolerance, 20 m on
  rides over 60 km) and stored as Google encoded polylines.

## Sources for factual claims

| Claim | Source |
|---|---|
| Google Maps has no bicycle directions in the Philippines; `travelmode` options | [visor.ph](https://visor.ph/traffic/dotr-is-asking-google-to-include-bike-lanes-in-map-app/), [Google Maps URLs docs](https://developers.google.com/maps/documentation/urls/get-started) |
| BGC bike-lane network; no current BGC car-free program found | [d0ctrine.com (2021)](https://d0ctrine.com/2021/12/04/bike-lanes-at-bgc/), [d0ctrine.com (2022)](https://d0ctrine.com/2022/06/26/bike-lanes-at-bonifacio-global-city), [Top Gear PH](https://www.topgear.com.ph/features/feature-articles/car-free-streets-in-metro-manila-a4682-20240729-lfrm) |
| Marikina has about 70 km of bike lanes | [Daily Tribune, Feb 2026](https://tribune.net.ph/2026/02/28/marikina-lights-bike-lanes-to-boost-mobility), [Manila Bulletin, Feb 2026](https://mb.com.ph/2026/02/28/marikina-lgu-lights-up-bike-lanes-with-92-led-lamps-to-ensure-cyclists-safety) |
| Tagaytay has no wind farm; the cycling wind farm near Manila is in Pililla, Rizal | [Inquirer Lifestyle](https://lifestyle.inquirer.net/?p=495019) |
| Bicycles are banned on Baguio's Session Road | [Inquirer](https://newsinfo.inquirer.net/?p=765387), [Top Gear PH](https://www.topgear.com.ph/news/motoring-news/memo-calls-for-implementation-of-ban-on-bicycles-motorcycles-in-baguio-city-a00058-20160215), [SunStar](https://www.sunstar.com.ph/article/1859003/Baguio/Local-News/Bikes-at-Session-Road-studied) |
| Iloilo bike lanes on Diversion Road; bike rules on the Esplanade vary by section | [Wikipedia: Iloilo Bridge](https://en.wikipedia.org/wiki/Iloilo_Bridge), [Wikipedia: Esplanade](https://en.wikipedia.org/wiki/Iloilo_River_Esplanade), [Panay News](https://www.panaynews.net/?p=253933) |
| Iloilo City's national bike-friendly awards | [Inquirer](https://newsinfo.inquirer.net/?p=1521551) |
| Davao is the Philippines' largest city by land area (2,443.61 km²) | [Wikipedia](https://en.wikipedia.org/wiki/Davao_City), [PhilAtlas](https://www.philatlas.com/cities.html) |
| Death March KM 00 marker in Mariveles; about 102 km to San Fernando | [Philstar](https://philstar.com/nation/2005/04/09/273226/world-war-ii-survivors-start-102-km-relay-bataan-pampanga), [Inquirer](https://newsinfo.inquirer.net/1654592/bikers-raise-funds-for-displaced-destroyed-death-march-markers/amp) |
| Lake Agco hot springs; Ilomavis Road surface (concrete) | [ThingsAsian](https://thingsasian.com/node/3260.html), OpenStreetMap `surface=concrete` |
| Samal boats from Sasa Wharf; bicycle fares listed | [SamalGuide](https://samalguide.com/news/samal-island-ferry-boat-rates/), [Noonsite](https://www.noonsite.com/place/philippines/mindanao-southern-region/davao/view/transport-and-travel) |
| Samal circumferential road surface (one unpaved section in Babak) | OpenStreetMap `surface` tags |
| Antipolo's nicknames (not "Lungsod ng Sining" or "City of the Stars") | [Wikipedia](https://en.wikipedia.org/wiki/Antipolo) |

Elevation ranges quoted in descriptions (for example "1,440–1,560 m" for Baguio) are the measured minimum
and maximum along the route.

## What changed

| Route now | Was called | Old figures | Measured |
|---|---|---|---|
| BGC Loop | BGC Grand Loop | 12 km, +30 m, beginner | 12.1 km, +40 m, beginner |
| Marikina River Park | Marikina River Park Trail | 18 km, +20 m, beginner | 13.2 km, flat, beginner |
| Valenzuela–Malabon City Ride | Valenzuela to Malabon Loop | 25 km, +15 m, beginner | 11.0 km, flat, beginner |
| Baguio: Burnham Park to Mines View | Baguio Burnham Park Loop | 8 km, +80 m, beginner | 19.0 km, +240 m, intermediate |
| Tagaytay via Santa Rosa | Tagaytay Windmill Loop | 45 km, +650 m, intermediate | 36.7 km, +490 m, intermediate |
| Batangas City to Anilao | Batangas Coastal Route | 50 km, +350 m, intermediate | 38.9 km, +180 m, intermediate |
| Cavite Heritage Loop | Cavite Heritage Loop | 35 km, +120 m, beginner | 26.7 km, flat, beginner |
| Cebu City to Oslob | Cebu South Coastal Highway | 100 km, +800 m, advanced | 115.8 km, +300 m, advanced |
| Mactan Island Loop | Mactan Island Loop | 28 km, +60 m, beginner | 19.9 km, flat, beginner |
| La Trinidad to Ambassador | La Trinidad Strawberry Valley | 30 km, +900 m, advanced | 23.9 km, +550 m, intermediate |
| Iloilo Diversion Road Bike Lane | Iloilo Esplanade Promenade | 20 km, +10 m, beginner | 12.1 km, flat, beginner |
| Subic Bay Freeport | Subic Freeport Zone Loop | 40 km, +300 m, intermediate | 43.0 km, +410 m, intermediate |
| Davao City to Calinan | Davao City Circumferential Route | 55 km, +200 m, intermediate | 55.5 km, +220 m, intermediate |
| Naga to Pili | Naga City River Loop | 32 km, +100 m, beginner | 23.2 km, flat, beginner |
| San Juan to Bacnotan | La Union Surfside Road | 25 km, +50 m, beginner | 23.1 km, +70 m, beginner |
| Death March Route: Mariveles to Balanga | Bataan Death March Road | 65 km, +400 m, intermediate | 43.4 km, +390 m, intermediate |
| Clark Freeport Ride | Clark Freeport Loop | 35 km, +80 m, beginner | 17.1 km, +80 m, beginner |
| Kidapawan to Lake Agco | Mt. Apo Foothills Gravel Loop | 40 km, +1200 m, advanced | 42.9 km, +1000 m, advanced |
| Antipolo via Sumulong Highway | Antipolo Lungsod ng Sining Loop | 30 km, +500 m, intermediate | 26.8 km, +320 m, intermediate |
| Samal Island Loop | Samal Island Loop | 70 km, +600 m, advanced | 87.3 km, +1350 m, advanced |
