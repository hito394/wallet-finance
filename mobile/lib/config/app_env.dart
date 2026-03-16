class AppEnv {
  static const appEnv = String.fromEnvironment("APP_ENV", defaultValue: "dev");
  static const apiBaseUrl = String.fromEnvironment(
    "API_BASE_URL",
    defaultValue: "http://10.0.2.2:8080",
  );
  static const enableVerboseLog =
      String.fromEnvironment("ENABLE_VERBOSE_LOG", defaultValue: "false") ==
      "true";

  static bool get isProd => appEnv == "prod";
}
