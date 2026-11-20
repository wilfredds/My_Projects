// Fails the build when test coverage drops below the project's thresholds.
//
//   flutter test --coverage
//   dart run tool/check_coverage.dart
//
// Thresholds come from PROMPT.md section 12. Written in Dart (not a shell
// one-liner or a third-party action) so it runs identically on Windows, macOS,
// Linux and CI, and so the rules are readable in the language of the project.
//
// This is a command-line tool: printing is its user interface.
// ignore_for_file: avoid_print
import 'dart:io';

/// Minimum line coverage, in percent, for files under each path prefix.
const thresholds = <String, double>{
  'lib/core/science/': 90,
  'lib/core/rules/': 90,
  'lib/': 70,
};

/// Generated code is excluded: we did not write it and do not test it.
bool isGenerated(String path) =>
    path.endsWith('.g.dart') ||
    path.endsWith('.freezed.dart') ||
    path.startsWith('lib/l10n/generated/');

void main(List<String> args) {
  final lcov = File(args.isEmpty ? 'coverage/lcov.info' : args.first);
  if (!lcov.existsSync()) {
    stderr.writeln('${lcov.path} not found. Run: flutter test --coverage');
    exit(2);
  }

  // lcov format: "SF:<path>" starts a file record, "DA:<line>,<hits>" reports
  // one executable line.
  final found = <String, int>{};
  final hit = <String, int>{};
  String? current;
  for (final line in lcov.readAsLinesSync()) {
    if (line.startsWith('SF:')) {
      final path = line.substring(3).replaceAll(r'\', '/');
      current = isGenerated(path) ? null : path;
    } else if (line.startsWith('DA:') && current != null) {
      final hits = int.parse(line.substring(3).split(',')[1]);
      found.update(current, (n) => n + 1, ifAbsent: () => 1);
      if (hits > 0) hit.update(current, (n) => n + 1, ifAbsent: () => 1);
    }
  }

  // A file that no test imports never appears in lcov.info, so it is
  // invisible rather than counted as 0%. We list those files as a warning.
  // It cannot be a hard failure: a file with no executable lines (an abstract
  // interface, a list of constants) is also absent from lcov.info, and the two
  // cases look identical from here. Read the warning and judge.
  final unreported =
      Directory('lib')
          .listSync(recursive: true)
          .whereType<File>()
          .map((file) => file.path.replaceAll(r'\', '/'))
          .where((path) => path.endsWith('.dart') && !isGenerated(path))
          .where((path) => !found.containsKey(path))
          .toList()
        ..sort();

  var failed = false;
  for (final MapEntry(key: prefix, value: minimum) in thresholds.entries) {
    final files = found.keys.where((path) => path.startsWith(prefix));
    if (files.isEmpty) {
      print('  -     $prefix (no files yet - need >= $minimum%)');
      continue;
    }
    final lines = files.fold(0, (sum, path) => sum + found[path]!);
    final covered = files.fold(0, (sum, path) => sum + (hit[path] ?? 0));
    final percent = covered * 100 / lines;
    final ok = percent >= minimum;
    failed = failed || !ok;
    print(
      '  ${ok ? 'ok  ' : 'FAIL'}  $prefix '
      '${percent.toStringAsFixed(1)}% of $lines lines (need >= $minimum%)',
    );
  }

  if (unreported.isNotEmpty) {
    print(
      '  warn  not in the coverage report (untested, or no executable code):',
    );
    for (final path in unreported) {
      print('        $path');
    }
  }

  if (failed) {
    stderr.writeln('Coverage is below the required thresholds.');
    exit(1);
  }
}
