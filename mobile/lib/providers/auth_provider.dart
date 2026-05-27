import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AuthUser {
  final String id;
  final String email;
  final String name;
  final bool hasDevtoKey;

  const AuthUser({
    required this.id,
    required this.email,
    required this.name,
    required this.hasDevtoKey,
  });
}

class AuthState {
  final AuthUser? user;
  final bool isLoading;
  final String? error;

  const AuthState({this.user, this.isLoading = false, this.error});

  bool get isAuthenticated => user != null;

  AuthState copyWith({AuthUser? user, bool? isLoading, String? error}) => AuthState(
        user: user ?? this.user,
        isLoading: isLoading ?? this.isLoading,
        error: error,
      );
}

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier() : super(const AuthState(isLoading: true)) {
    _init();
  }

  Future<void> _init() async {
    FirebaseAuth.instance.authStateChanges().listen((firebaseUser) async {
      if (firebaseUser == null) {
        state = const AuthState();
        return;
      }
      state = AuthState(user: await _loadUser(firebaseUser));
    });
  }

  Future<AuthUser> _loadUser(User firebaseUser) async {
    final doc = await FirebaseFirestore.instance
        .collection('users')
        .doc(firebaseUser.uid)
        .get();
    final data = doc.data();
    return AuthUser(
      id: firebaseUser.uid,
      email: firebaseUser.email ?? '',
      name: data?['name'] as String? ?? firebaseUser.displayName ?? 'User',
      hasDevtoKey: data?['devtoApiKey'] != null,
    );
  }

  Future<bool> login(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
      // authStateChanges listener will update state
      return true;
    } on FirebaseAuthException catch (e) {
      state = AuthState(error: _authError(e));
      return false;
    } catch (e) {
      state = AuthState(error: e.toString());
      return false;
    }
  }

  Future<bool> register(String email, String password, String name) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final credential = await FirebaseAuth.instance.createUserWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
      final user = credential.user!;
      await user.updateDisplayName(name.trim());

      // Create user document in Firestore
      await FirebaseFirestore.instance.collection('users').doc(user.uid).set({
        'name': name.trim(),
        'email': email.trim().toLowerCase(),
      });

      // authStateChanges listener will update state
      return true;
    } on FirebaseAuthException catch (e) {
      state = AuthState(error: _authError(e));
      return false;
    } catch (e) {
      state = AuthState(error: e.toString());
      return false;
    }
  }

  Future<void> logout() async {
    await FirebaseAuth.instance.signOut();
    // authStateChanges listener will set state to unauthenticated
  }

  Future<bool> updateProfile({String? name, String? devtoApiKey}) async {
    final currentUser = state.user;
    if (currentUser == null) return false;
    try {
      if (name != null && name.trim().isNotEmpty) {
        await FirebaseFirestore.instance
            .collection('users')
            .doc(currentUser.id)
            .update({'name': name.trim()});
        await FirebaseAuth.instance.currentUser?.updateDisplayName(name.trim());
      }
      if (devtoApiKey != null && devtoApiKey.trim().isNotEmpty) {
        await FirebaseFunctions.instance
            .httpsCallable('setDevtoApiKey')
            .call({'devtoApiKey': devtoApiKey.trim()});
      }
      // Reload profile
      final firebaseUser = FirebaseAuth.instance.currentUser;
      if (firebaseUser != null) {
        state = state.copyWith(user: await _loadUser(firebaseUser));
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  String _authError(FirebaseAuthException e) {
    switch (e.code) {
      case 'user-not-found':
      case 'wrong-password':
      case 'invalid-credential':
        return 'Invalid email or password';
      case 'email-already-in-use':
        return 'Email already in use';
      case 'weak-password':
        return 'Password must be at least 6 characters';
      case 'invalid-email':
        return 'Invalid email format';
      default:
        return e.message ?? 'Authentication failed';
    }
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) => AuthNotifier());
