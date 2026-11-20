import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Enforces the rule from PROMPT.md section 5: "Domain and science code must
/// not import Flutter." A rule that lives only in a document gets broken by
/// accident; a test makes breaking it a red build.
void main() {
  const forbidden = [
    'package:flutter/',
    'package:material_ui/',
    'package:cupertino_ui/',
    'package:flutter_riverpod/',
    'package:go_router/',
    'dart:ui',
  ];

  bool isPureLayer(String path) =>
      path.contains('/domain/') ||
      path.startsWith('lib/core/science/') ||
      path.startsWith('lib/core/rules/');

  final pureFiles = Directory('lib')
      .listSync(recursive: true)
      .whereType<File>()
      .map((file) => file.path.replaceAll(r'\', '/'))
      .where((path) => path.endsWith('.dart') && isPureLayer(path))
      .toList();

  test('the scan actually finds pure-layer files', () {
    // Guards against this test passing vacuously if folders are renamed.
    expect(pureFiles, isNotEmpty);
  });

  for (final path in pureFiles) {
    test('$path imports no UI framework', () {
      final imports = File(path)
          .readAsLinesSync()
          .where((line) => line.trimLeft().startsWith(RegExp('import|export')))
          .toList();

      for (final banned in forbidden) {
        expect(
          imports.where((line) => line.contains(banned)),
          isEmpty,
          reason: '$path is in a framework-free layer but imports $banned',
        );
      }
    });
  }
}
