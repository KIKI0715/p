import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'secure_storage.dart';

class ApiClient {
  // Override at build time: flutter run --dart-define=API_BASE_URL=http://YOUR_IP:3000/api
  // Android emulator default: http://10.0.2.2:3000/api
  // iOS simulator default:    http://localhost:3000/api
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000/api',
  );

  static const Duration _timeout = Duration(seconds: 15);

  static Future<Map<String, String>> _headers() async {
    final token = await SecureStorage.getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  static Future<http.Response> _run(Future<http.Response> Function() request) async {
    try {
      return await request().timeout(_timeout);
    } on TimeoutException {
      throw const SocketException(
          'Server did not respond in time. Is the backend running? (15s timeout)');
    } on SocketException catch (e) {
      throw SocketException(
          'Cannot reach server at $baseUrl — ${e.osError?.message ?? e.message}');
    } on http.ClientException catch (e) {
      throw SocketException('Cannot reach server at $baseUrl — ${e.message}');
    }
  }

  static Future<http.Response> get(String path) =>
      _run(() async => http.get(Uri.parse('$baseUrl$path'), headers: await _headers()));

  static Future<http.Response> post(String path, Map<String, dynamic> body) =>
      _run(() async => http.post(
            Uri.parse('$baseUrl$path'),
            headers: await _headers(),
            body: jsonEncode(body),
          ));

  static Future<http.Response> put(String path, Map<String, dynamic> body) =>
      _run(() async => http.put(
            Uri.parse('$baseUrl$path'),
            headers: await _headers(),
            body: jsonEncode(body),
          ));

  static Future<http.Response> delete(String path) =>
      _run(() async => http.delete(Uri.parse('$baseUrl$path'), headers: await _headers()));

  static Map<String, dynamic> parseJson(http.Response response) {
    final decoded = jsonDecode(response.body);
    if (decoded is Map<String, dynamic>) return decoded;
    throw FormatException('Expected JSON object, got ${decoded.runtimeType}');
  }

  static List<dynamic> parseJsonList(http.Response response) {
    final decoded = jsonDecode(response.body);
    if (decoded is List) return decoded;
    throw FormatException('Expected JSON array, got ${decoded.runtimeType}');
  }
}
