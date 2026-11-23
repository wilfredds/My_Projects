/// The groups a race checklist is organised into.
enum ChecklistGroup { bike, kit, documents, nutrition, tools }

/// Everything worth checking before a race (PROMPT.md section 8, Phase 2).
/// The same list is reused for every race; what is stored per race is only
/// which items are ticked.
enum ChecklistItem {
  tyrePressure(ChecklistGroup.bike),
  wheelsSecure(ChecklistGroup.bike),
  boltsTight(ChecklistGroup.bike),
  brakesWork(ChecklistGroup.bike),
  gearsShift(ChecklistGroup.bike),
  barEndPlugs(ChecklistGroup.bike),

  helmet(ChecklistGroup.kit),
  shoes(ChecklistGroup.kit),
  jerseyAndShorts(ChecklistGroup.kit),
  glovesAndGlasses(ChecklistGroup.kit),
  sunscreen(ChecklistGroup.kit),

  identification(ChecklistGroup.documents),
  licenceOrWaiver(ChecklistGroup.documents),
  raceNumberAndPins(ChecklistGroup.documents),

  bottlesFilled(ChecklistGroup.nutrition),
  raceFood(ChecklistGroup.nutrition),
  preRaceMealPlanned(ChecklistGroup.nutrition),

  spareTube(ChecklistGroup.tools),
  pumpOrInflator(ChecklistGroup.tools),
  multiTool(ChecklistGroup.tools);

  new(this.group);

  final ChecklistGroup group;

  static List<ChecklistItem> inGroup(ChecklistGroup group) => [
    for (final item in values)
      if (item.group == group) item,
  ];
}
