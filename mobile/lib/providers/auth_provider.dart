import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api_client.dart';
import '../core/secure_storage.dart';

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

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
        id: json['id'] as String,
        email: json['email'] as String,
        name: json['name'] as String,
        hasDevtoKey: json['hasDevtoKey'] as bool? ?? false,
      );
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
    final token = await SecureStorage.getToken();
    if (token == null) {
      state = const AuthState();
      return;
    }
    try {
      final response = await ApiClient.get('/auth/me');
      if (response.statusCode == 200) {
        final json = ApiClient.parseJson(response);
        state = AuthState(user: AuthUser.fromJson(json));
      } else {
        await SecureStorage.deleteToken();
        state = const AuthState();
      }
    } catch (_) {
      state = const AuthState();
    }
  }

  Future<bool> login(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await ApiClient.post('/auth/login', {'email': email, 'password': password});
      if (response.statusCode == 200) {
        final json = ApiClient.parseJson(response);
        await SecureStorage.saveToken(json['token'] as String);
        state = AuthState(user: AuthUser.fromJson(json['user'] as Map<String, dynamic>));
        return true;
      }
      final err = jsonDecode(response.body)['error'] as String? ?? 'Login failed';
      state = AuthState(error: err);
      return false;
    } catch (e) {
      state = AuthState(error: e.toString());
      return false;
    }
  }

  Future<bool> register(String email, String password, String name) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await ApiClient.post('/auth/register', {
        'email': email,
        'password': password,
        'name': name,
      });
      if (response.statusCode == 201) {
        final json = ApiClient.parseJson(response);
        await SecureStorage.saveToken(json['token'] as String);
        state = AuthState(user: AuthUser.fromJson(json['user'] as Map<String, dynamic>));
        return true;
      }
      final err = jsonDecode(response.body)['error'] as String? ?? 'Registration failed';
      state = AuthState(error: err);
      return false;
    } catch (e) {
      state = AuthState(error: e.toString());
      return false;
    }
  }

  Future<void> logout() async {
    await SecureStorage.deleteToken();
    state = const AuthState();
  }

  Future<bool> updateProfile({String? name, String? devtoApiKey}) async {
    try {
      final response = await ApiClient.put('/auth/me', {
        if (name != null) 'name': name,
        if (devtoApiKey != null) 'devtoApiKey': devtoApiKey,
      });
      if (response.statusCode == 200) {
        final json = ApiClient.parseJson(response);
        state = state.copyWith(user: AuthUser.fromJson(json));
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) => AuthNotifier());
