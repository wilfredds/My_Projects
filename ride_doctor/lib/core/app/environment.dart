import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:uuid/uuid.dart';

part 'environment.g.dart';

/// The current time. A provider rather than a bare `DateTime.now()` so tests
/// can fix "now" and get the same result every run - essential once dates
/// drive behaviour (age, race countdowns).
@Riverpod(keepAlive: true)
DateTime Function() clock(Ref ref) => DateTime.now;

/// Makes new row ids (random UUIDs).
@Riverpod(keepAlive: true)
String Function() idGenerator(Ref ref) => const Uuid().v4;
