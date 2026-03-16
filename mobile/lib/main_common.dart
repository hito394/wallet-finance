import "package:flutter/widgets.dart";

import "app/app.dart";
import "lifecycle/app_lifecycle_handler.dart";
import "services/auth_session_store.dart";

Future<void> runAppCommon() async {
  WidgetsFlutterBinding.ensureInitialized();

  final sessionStore = AuthSessionStore();
  final initialSession = await sessionStore.restore();
  AuthSession? currentSession = initialSession;

  final lifecycleHandler = AppLifecycleHandler(
    sessionStore: sessionStore,
    readCurrentSession: () => currentSession,
  );
  WidgetsBinding.instance.addObserver(lifecycleHandler);

  runApp(WalletApp(initialSession: initialSession));

  // In app state management, update this when login/logout happens.
  currentSession = initialSession;
}
