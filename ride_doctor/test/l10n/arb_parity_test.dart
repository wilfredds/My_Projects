import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Every message must exist in every language. Without this, a string added
/// in English only would silently show English to Filipino users.
void main() {
  Set<String> messageKeys(String path) {
    final arb =
        jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;
    return arb.keys.where((key) => !key.startsWith('@')).toSet();
  }

  final english = messageKeys('lib/l10n/app_en.arb');
  final filipino = messageKeys('lib/l10n/app_fil.arb');

  test('Filipino has every English message', () {
    expect(english.difference(filipino), isEmpty);
  });

  test('Filipino has no messages English lacks', () {
    expect(filipino.difference(english), isEmpty);
  });

  test('no Filipino message is blank', () {
    final arb = jsonDecode(
      File('lib/l10n/app_fil.arb').readAsStringSync(),
    ) as Map<String, dynamic>;
    final blank = filipino.where((key) => (arb[key] as String).trim().isEmpty);
    expect(blank, isEmpty);
  });
}
