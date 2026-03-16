# Mobile Setup (Flutter)

This folder is structured for real-device iPhone deployment.

## 1. Initialize Flutter project files if needed

If `ios/` or `android/` folders do not exist yet:

```bash
cd mobile
flutter create .
```

Then keep using the existing `lib/` and `env/` files in this repository.

## 2. Run with dev configuration

```bash
flutter run \
  -t lib/main_dev.dart \
  --dart-define-from-file=env/dev.json
```

## 3. Run release mode on physical iPhone

```bash
flutter run \
  --release \
  -t lib/main_prod.dart \
  --dart-define-from-file=env/prod.json
```

## 4. Build distributable ipa

```bash
flutter build ipa \
  --release \
  -t lib/main_prod.dart \
  --dart-define-from-file=env/prod.json
```

## 5. API base URL guidance

- iOS Simulator: `http://127.0.0.1:8080`
- Android Emulator: `http://10.0.2.2:8080`
- Physical iPhone (same LAN): `http://<your-mac-lan-ip>:8080`
- Daily-use build: `https://your-api-domain`

Never ship a production build with localhost-only assumptions.
