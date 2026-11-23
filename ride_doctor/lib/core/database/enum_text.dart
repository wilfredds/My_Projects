/// Reads an enum stored as its name. Returns null for null or for a name this
/// version of the app does not know - which happens when a newer version
/// wrote the row, and must not crash an older one.
T? enumFromName<T extends Enum>(List<T> values, String? name) {
  if (name == null) return null;
  for (final value in values) {
    if (value.name == name) return value;
  }
  return null;
}

/// Tooth counts <-> the comma-separated text they are stored as.
String teethToText(List<int> teeth) => teeth.join(',');

List<int> teethFromText(String text) => [
  for (final part in text.split(',')) ?int.tryParse(part.trim()),
];
