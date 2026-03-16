import "package:flutter/widgets.dart";

import "../services/auth_session_store.dart";

class AppLifecycleHandler extends WidgetsBindingObserver {
  AppLifecycleHandler({
    required AuthSessionStore sessionStore,
    required AuthSession? Function() readCurrentSession,
  })  : _sessionStore = sessionStore,
        _readCurrentSession = readCurrentSession;

  final AuthSessionStore _sessionStore;
  final AuthSession? Function() _readCurrentSession;

  @override
  Future<void> didChangeAppLifecycleState(AppLifecycleState state) async {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive) {
      final session = _readCurrentSession();
      if (session != null) {
        await _sessionStore.save(session);
      }
    }
  }
}
