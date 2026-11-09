import 'dart:ui' show ViewFocusDirection, ViewFocusEvent, ViewFocusState;

import 'package:cyclemind_ai/app/app.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

// The web console showed "Null check operator used on a null value" on every
// Back from a bike. On the web, the browser reports focus changes while a
// frame is being drawn, and Flutter then measures every focusable widget. On
// Back, one of those was half torn down: the floating action button copy that
// a Hero flight animates between the Bikes and bike screens, because their
// two unrelated buttons shared the default hero tag.
//
// This drives the real app through that Back, delivering a focus event
// mid-frame on every frame of the transition, as the browser can.

/// Fires an action once, during the next paint: mid-frame.
class _Trigger {
  VoidCallback? _armed;
  _RenderPaintHook? _render;

  void arm(VoidCallback action) {
    _armed = action;
    _render?.markNeedsPaint();
  }
}

class _PaintHook extends SingleChildRenderObjectWidget {
  const _PaintHook({required this.trigger, required super.child});

  final _Trigger trigger;

  @override
  RenderObject createRenderObject(BuildContext context) =>
      _RenderPaintHook(trigger);
}

class _RenderPaintHook extends RenderProxyBox {
  _RenderPaintHook(this.trigger) {
    trigger._render = this;
  }

  final _Trigger trigger;

  @override
  void paint(PaintingContext context, Offset offset) {
    super.paint(context, offset);
    final action = trigger._armed;
    trigger._armed = null;
    action?.call();
  }
}

void main() {
  testWidgets('going Back from a bike leaves nothing focusable half torn down',
      (tester) async {
    final trigger = _Trigger();
    await tester.pumpWidget(ProviderScope(
      child: _PaintHook(trigger: trigger, child: const CycleMindApp()),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sign in'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Bikes'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Roadie'));
    await tester.pumpAndSettle();
    expect(find.text('Component wear'), findsOneWidget);

    // A focus event in the middle of every frame of the Back transition.
    var delivered = 0;
    var running = true;
    void eachFrame(Duration _) {
      if (!running) return;
      trigger.arm(() {
        delivered++;
        tester.binding.handleViewFocusChanged(ViewFocusEvent(
          viewId: tester.view.viewId,
          state: ViewFocusState.focused,
          direction: ViewFocusDirection.forward,
        ));
      });
      SchedulerBinding.instance.scheduleFrameCallback(eachFrame);
    }

    SchedulerBinding.instance.scheduleFrameCallback(eachFrame);
    await tester.tap(find.byTooltip('Back'));
    for (var i = 0; i < 40; i++) {
      await tester.pump(const Duration(milliseconds: 16));
    }
    running = false;
    await tester.pumpAndSettle();

    expect(delivered, greaterThan(10),
        reason: 'events must really arrive mid-frame, across the transition');
    expect(tester.takeException(), isNull);
    expect(find.text('My bikes'), findsOneWidget);
  });
}
