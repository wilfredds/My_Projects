import 'dart:async';

import 'package:cyclemind_ai/core/error/failures.dart';
import 'package:cyclemind_ai/core/providers/mock_store.dart';
import 'package:cyclemind_ai/core/utils/result.dart';
import 'package:cyclemind_ai/features/auth/domain/entities/app_user.dart';
import 'package:cyclemind_ai/features/auth/domain/repositories/auth_repository.dart';
import 'package:uuid/uuid.dart';

/// In-memory [AuthRepository] used when `USE_MOCKS=true`.
///
/// Signing IN accepts any credentials and returns the seeded demo user, so a
/// reviewer sees the populated demo. Signing UP mints a brand-new identity
/// with an empty garage.
///
/// This repository is the single source of truth for who is signed in.
/// [MockStore] holds data only — it deliberately has no user setter, because
/// one let a signed-up user's profile edit overwrite the demo identity.
class MockAuthRepository implements AuthRepository {
  final _controller = StreamController<AppUser?>.broadcast();
  AppUser? _current;

  @override
  Stream<AppUser?> authStateChanges() async* {
    yield _current;
    yield* _controller.stream;
  }

  @override
  AppUser? get currentUser => _current;

  @override
  Future<Result<AppUser>> signInWithEmail({
    required String email,
    required String password,
  }) =>
      _completeSignIn();

  @override
  Future<Result<AppUser>> signUpWithEmail({
    required String email,
    required String password,
    required String displayName,
  }) async {
    // A fresh uuid, NOT the seed user's id. Reusing it was what made a new
    // sign-up inherit the previous user's bikes and rides.
    final user = AppUser(
      id: 'mock-${const Uuid().v4()}',
      email: email,
      profile: UserProfile(displayName: displayName),
    );
    _current = user;
    _controller.add(user);
    return Success(user);
  }

  @override
  Future<Result<AppUser>> signInWithGoogle() => _completeSignIn();

  @override
  Future<Result<AppUser>> updateProfile(AppUser user) async {
    _current = user;
    _controller.add(user);
    return Success(user);
  }

  @override
  Future<Result<void>> signOut() async {
    // Order matters: clear the session FIRST so every stream sees an empty
    // userId and goes quiet, then wipe the store. Resetting first would let a
    // listener observe a half-cleared store.
    _current = null;
    _controller.add(null);
    await MockStore.instance.reset();
    return const Success(null);
  }

  Future<Result<AppUser>> _completeSignIn() async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    try {
      await MockStore.instance.ensureLoaded();
      _current = MockStore.instance.seedUser;
      _controller.add(_current);
      return Success(_current!);
    } catch (_) {
      return Failure(const AuthFailure());
    }
  }
}
