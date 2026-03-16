import "dart:convert";

import "package:flutter_secure_storage/flutter_secure_storage.dart";

class AuthSession {
  AuthSession({required this.accessToken, this.refreshToken, this.userId});

  final String accessToken;
  final String? refreshToken;
  final String? userId;

  Map<String, dynamic> toMap() {
    return {
      "accessToken": accessToken,
      "refreshToken": refreshToken,
      "userId": userId,
    };
  }

  static AuthSession fromMap(Map<String, dynamic> map) {
    return AuthSession(
      accessToken: map["accessToken"] as String,
      refreshToken: map["refreshToken"] as String?,
      userId: map["userId"] as String?,
    );
  }
}

class AuthSessionStore {
  AuthSessionStore({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  static const _sessionKey = "auth_session_v1";
  final FlutterSecureStorage _storage;

  Future<void> save(AuthSession session) async {
    final encoded = jsonEncode(session.toMap());
    await _storage.write(key: _sessionKey, value: encoded);
  }

  Future<AuthSession?> restore() async {
    final encoded = await _storage.read(key: _sessionKey);
    if (encoded == null || encoded.isEmpty) {
      return null;
    }

    final decoded = jsonDecode(encoded) as Map<String, dynamic>;
    return AuthSession.fromMap(decoded);
  }

  Future<void> clear() {
    return _storage.delete(key: _sessionKey);
  }
}
