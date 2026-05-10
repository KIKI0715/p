import 'dart:convert';
import 'package:http/http.dart' as http;
import 'secure_storage.dart';

class ApiClient {
  static const String baseUrl = 'http://localhost:3000/api';

  static Future<Map<String, String>> _headers() async {
    final token = await SecureStorage.getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  static Future<http.Response> get(String path) async {
    final response = await http.get(
      Uri.parse('$baseUrl$path'),
      headers: await _headers(),
    );
    return response;
  }

  static Future<http.Response> post(String path, Map<String, dynamic> body) async {
    final response = await http.post(
      Uri.parse('$baseUrl$path'),
      headers: await _headers(),
      body: jsonEncode(body),
    );
    return response;
  }

  static Future<http.Response> put(String path, Map<String, dynamic> body) async {
    final response = await http.put(
      Uri.parse('$baseUrl$path'),
      headers: await _headers(),
      body: jsonEncode(body),
    );
    return response;
  }

  static Future<http.Response> delete(String path) async {
    final response = await http.delete(
      Uri.parse('$baseUrl$path'),
      headers: await _headers(),
    );
    return response;
  }

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
