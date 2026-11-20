import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';

/// Lists every tappable control on screen smaller than [minSize] in either
/// dimension, as "label: size". Empty means the screen passes.
///
/// Why not `meetsGuideline(androidTapTargetGuideline)`? That matcher skips any
/// control touching the edge of the screen (it assumes the control may be
/// half scrolled away). Full-width list rows and app-bar buttons all touch an
/// edge, so on our screens it checked almost nothing - an undersized settings
/// button passed it. This walks the same semantics tree without that
/// exemption, so call it only when nothing tappable is partly scrolled off.
List<String> undersizedTapTargets(WidgetTester tester, {double minSize = 48}) {
  final failures = <String>[];

  void visit(SemanticsNode node) {
    node.visitChildren((child) {
      visit(child);
      return true;
    });
    if (node.isMergedIntoParent) return;

    final data = node.getSemanticsData();
    if (!data.hasAction(SemanticsAction.tap) || data.flagsCollection.isHidden) {
      return;
    }

    // Layout maths is floating point: 47.99999 is 48.
    const tolerance = 0.01;
    final size = node.rect.size;
    if (size.width < minSize - tolerance || size.height < minSize - tolerance) {
      final name = data.label.isNotEmpty ? data.label : data.tooltip;
      failures.add('${name.isEmpty ? '(unlabelled)' : name}: $size');
    }
  }

  final root =
      tester.binding.renderViews.first.owner!.semanticsOwner!.rootSemanticsNode;
  visit(root!);
  return failures;
}
