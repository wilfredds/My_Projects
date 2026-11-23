/// How much a rider should trust a number, weakest first.
///
/// The order matters: [weakest] relies on it.
enum Confidence {
  /// A formula applied to weak, default or assumed inputs.
  rough,

  /// A published formula applied to inputs the rider actually gave us.
  estimated,

  /// From a sensor, or a test the rider performed.
  measured;

  /// A result is only as trustworthy as its least trustworthy input: one
  /// guessed input makes the whole answer a guess.
  static Confidence weakest(Iterable<Confidence> all) =>
      all.reduce((a, b) => a.index <= b.index ? a : b);
}
