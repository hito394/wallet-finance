import "dart:async";
import "dart:convert";
import "dart:io";

import "package:http/http.dart" as http;

class UploadService {
  UploadService({required this.baseUrl, http.Client? client})
      : _client = client ?? http.Client();

  final String baseUrl;
  final http.Client _client;

  Future<String> uploadFile({
    required File file,
    required String bearerToken,
    String fieldName = "file",
  }) async {
    final uri = Uri.parse("$baseUrl/upload");
    final request = http.MultipartRequest("POST", uri)
      ..headers["Authorization"] = "Bearer $bearerToken"
      ..headers["Idempotency-Key"] =
          "${file.path}_${file.lengthSync()}_${DateTime.now().millisecondsSinceEpoch}"
      ..files.add(await http.MultipartFile.fromPath(fieldName, file.path));

    final streamed = await _client.send(request).timeout(
      const Duration(seconds: 60),
    );
    final response = await http.Response.fromStream(streamed);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception("Upload failed: ${response.statusCode} ${response.body}");
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return data["url"] as String;
  }
}
