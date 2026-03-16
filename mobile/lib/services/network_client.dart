import "dart:async";
import "dart:convert";
import "dart:io";

import "package:http/http.dart" as http;

class NetworkException implements Exception {
  NetworkException(this.message);
  final String message;

  @override
  String toString() => "NetworkException: $message";
}

class NetworkClient {
  NetworkClient({required this.baseUrl, http.Client? client, Duration? timeout})
      : _client = client ?? http.Client(),
        _timeout = timeout ?? const Duration(seconds: 20);

  final String baseUrl;
  final http.Client _client;
  final Duration _timeout;

  Future<Map<String, dynamic>> getJson(String path, {String? bearerToken}) async {
    final uri = Uri.parse("$baseUrl$path");
    try {
      final response = await _client
          .get(
            uri,
            headers: {
              "Accept": "application/json",
              if (bearerToken != null) "Authorization": "Bearer $bearerToken",
            },
          )
          .timeout(_timeout);

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      }

      throw NetworkException(
        "Request failed: ${response.statusCode} ${response.reasonPhrase}",
      );
    } on TimeoutException {
      throw NetworkException("Request timed out");
    } on SocketException {
      throw NetworkException("No internet connection or DNS failure");
    }
  }
}
