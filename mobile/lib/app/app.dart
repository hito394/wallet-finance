import "package:flutter/material.dart";

import "../services/auth_session_store.dart";

class WalletApp extends StatelessWidget {
  const WalletApp({super.key, required this.initialSession});

  final AuthSession? initialSession;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: "Wallet",
      home: Scaffold(
        appBar: AppBar(title: const Text("Wallet")),
        body: Center(
          child: Text(
            initialSession == null
                ? "No active session"
                : "Signed in as ${initialSession!.userId ?? "unknown"}",
          ),
        ),
      ),
    );
  }
}
