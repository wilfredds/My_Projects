import 'dart:async';

import 'package:cyclemind_ai/core/providers/sync_errors.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Shows every [SyncErrors] message as a snackbar, on whatever screen is open.
///
/// Mounted once, in `MaterialApp.router(builder: ...)`, which sits below the
/// app's root ScaffoldMessenger. It subscribes to the stream directly rather
/// than through a StreamProvider, because equal AsyncData values would merge
/// two identical failures into one notice.
class SyncErrorListener extends ConsumerStatefulWidget {
  const SyncErrorListener({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<SyncErrorListener> createState() => _SyncErrorListenerState();
}

class _SyncErrorListenerState extends ConsumerState<SyncErrorListener> {
  StreamSubscription<String>? _subscription;

  @override
  void initState() {
    super.initState();
    _subscription = ref.read(syncErrorsProvider).messages.listen((message) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));
    });
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
