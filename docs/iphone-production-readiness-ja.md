# iPhone実機運用を前提にした本番設計ガイド（Flutter + API Backend）

このドキュメントは、"Xcodeから毎回起動しないと動かない開発アプリ"ではなく、
**通常インストール後も安定動作する個人利用アプリ**として育てるための設計基準です。

## 0. ゴール

- iOS実機でのリリースビルド（`ipa`）を安定動作させる
- 開発環境と本番環境を明確に分離する
- API接続を`localhost`前提にしない
- アプリ再起動・バックグラウンド遷移でも重要状態を保持する
- バックエンドをRender/Railway/Fly.io/AWS/GCPなどへ移行しやすくする

---

## 1. 推奨プロジェクト構成（実機運用向け）

```text
WALLET/
  mobile/
    lib/
      app/
      config/
        app_env.dart
      data/
        local/
        remote/
      services/
        auth_session_store.dart
        upload_service.dart
      lifecycle/
        app_lifecycle_handler.dart
      main_common.dart
      main_dev.dart
      main_prod.dart
    env/
      dev.json
      prod.json
    ios/
      Runner/
        Info.plist
        Runner.entitlements
  backend/
    src/
      config/
      routes/
      storage/
        storage_adapter.ts
        local_storage.ts
        s3_storage.ts
      db/
        migrations/
    .env.example
    .env.production.example
    Dockerfile
```

要点:
- `main_dev.dart` / `main_prod.dart`で起動設定を分離
- API URL、ログレベル、機能フラグは`dart-define`経由で注入
- 端末永続データ（トークン/キャッシュ）はサービス層で一元管理
- Backendは「ローカルストレージ実装」と「クラウドストレージ実装」を抽象化で切替可能にする

---

## 2. 開発/本番の環境分離（Deliverable 1）

### Flutter側

`mobile/env/dev.json`
```json
{
  "APP_ENV": "dev",
  "API_BASE_URL": "http://192.168.1.20:8080",
  "ENABLE_VERBOSE_LOG": "true"
}
```

`mobile/env/prod.json`
```json
{
  "APP_ENV": "prod",
  "API_BASE_URL": "https://api.example.com",
  "ENABLE_VERBOSE_LOG": "false"
}
```

`lib/config/app_env.dart`
```dart
class AppEnv {
  static const appEnv = String.fromEnvironment('APP_ENV', defaultValue: 'dev');
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8080',
  );
  static const enableVerboseLog =
      String.fromEnvironment('ENABLE_VERBOSE_LOG', defaultValue: 'false') == 'true';

  static bool get isProd => appEnv == 'prod';
}
```

`main_dev.dart`
```dart
import 'main_common.dart';

void main() {
  runAppCommon();
}
```

`main_prod.dart`
```dart
import 'main_common.dart';

void main() {
  runAppCommon();
}
```

ビルド例:

```bash
# 開発（実機テスト）
flutter run \
  --flavor dev \
  -t lib/main_dev.dart \
  --dart-define-from-file=env/dev.json

# 本番相当（ローカル確認）
flutter run \
  --release \
  -t lib/main_prod.dart \
  --dart-define-from-file=env/prod.json

# 配布用ipa
flutter build ipa \
  --release \
  -t lib/main_prod.dart \
  --dart-define-from-file=env/prod.json
```

### Backend側

`.env.example`
```env
NODE_ENV=development
PORT=8080
DATABASE_URL=postgres://user:pass@localhost:5432/wallet
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
STORAGE_DRIVER=local
LOCAL_UPLOAD_DIR=./uploads
JWT_SECRET=change-me
```

`.env.production.example`
```env
NODE_ENV=production
PORT=8080
DATABASE_URL=postgres://...
CORS_ORIGINS=https://wallet.example.com,https://api.example.com
STORAGE_DRIVER=s3
S3_BUCKET=wallet-prod
S3_REGION=ap-northeast-1
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
JWT_SECRET=strong-random-secret
```

---

## 3. API URL設定（シミュレータ/エミュレータ/実機）（Deliverable 2）

`API_BASE_URL`の原則:
- iOS Simulator: `http://127.0.0.1:8080` または `http://localhost:8080`（Mac上API向け）
- Android Emulator: `http://10.0.2.2:8080`
- 物理iPhone（同一LAN）: `http://<MacのLAN IP>:8080`
- 配布版/常用版: `https://api.example.com`（必ずHTTPS）

注意:
- **実機運用を考えるなら最終的にlocalhostは使わない**
- TestFlightや通常インストール時にAPI不達になる典型原因はURL固定

---

## 4. iPhone安定リリースの準備（Deliverable 3）

1. iOS署名関連を固定
- Bundle IDを最初に決める（後変更は手間）
- Apple Developer Programで証明書/プロビジョニングを整理
- Debug/Releaseで署名設定が分かれているか確認

2. 本番用設定で必ず実機検証
- `flutter run --release ...` で起動確認
- 起動直後、ログイン、API通信、再起動、アップロードを通し確認

3. ATS/ネットワーク方針
- 本番はHTTPSのみ
- `NSAppTransportSecurity`の緩和はDebug限定

4. 永続データの設計
- 認証トークン: `flutter_secure_storage`
- キャッシュ/下書き: `Hive` または `sqflite`

5. クラッシュ監視
- Firebase CrashlyticsまたはSentry導入

---

## 5. Xcode起動時だけ動く問題と回避策（Deliverable 4）

よくある原因:
1. `localhost`固定で実機からAPIに到達できない
2. Xcode Schemeでだけ環境変数を注入している
3. Debug専用ATS緩和に依存している
4. 認証情報をメモリのみ保持し、再起動で消える
5. 一時ディレクトリへ重要データを置いて再起動で消失
6. 権限文言（`Info.plist`）不足で本番動作時に機能停止
7. 開発証明書・自動署名に依存しRelease設定が未整備

回避原則:
- 環境注入は`dart-define`に統一
- 認証/下書きは永続ストレージへ
- Releaseビルドを日常的に実機確認
- APIはHTTPSのホストURLを前提に設計

---

## 6. ローカルBackendからホスト環境への移行手順（Deliverable 5）

1. 設定の環境変数化
- DB接続、CORS、ストレージ、JWT秘密鍵をコード直書きしない

2. DBマイグレーション整備
- Prisma/Alembic/TypeORMなどで`migrations/`を管理
- 起動時に安全に適用する仕組みを用意

3. ストレージ抽象化
- `StorageAdapter`を定義し、`local`と`s3`を切替

4. CORSとセキュリティヘッダ
- 許可Originを環境変数で管理
- `*`常時許可を避ける

5. デプロイ
- Render/Railway/Fly.io/AWS/GCPのいずれかでAPI公開
- HTTPS証明書、ヘルスチェック、ログ収集を有効化

6. モバイル側切替
- `prod.json`の`API_BASE_URL`を公開URLに変更
- 実機Releaseで疎通確認

---

## 7. iOSで準備すべき設定ファイル（Deliverable 6）

`ios/Runner/Info.plist`:
- `NSCameraUsageDescription`
- `NSPhotoLibraryUsageDescription`
- `NSPhotoLibraryAddUsageDescription`（必要時）
- `NSMicrophoneUsageDescription`（必要時）
- 必要最小限のATS設定（本番はHTTPSのみ）

`ios/Runner/Runner.entitlements`:
- Keychain sharing（必要時）
- Associated Domains（Universal Links利用時）
- Push通知利用時のCapabilities

Xcode Target設定:
- Signing & Capabilities（Debug/Release双方）
- Deployment Target（使用プラグイン互換を確認）
- Background Modes（必要機能のみ有効化）

---

## 8. 日常利用で壊れにくくする実装（Deliverable 7）

1. 起動シーケンスを固定化
- `main`で初期化順序を明確化（Storage -> Session復元 -> APIクライアント -> UI起動）

2. セッション永続化
- アクセストークン/リフレッシュトークンを安全保存
- 401時の再認証フローを統一

3. ネットワーク失敗時のUI/再試行
- タイムアウト、DNS失敗、5xxを分類
- 指数バックオフで再試行
- ユーザー向けエラー文を統一

4. アップロード堅牢化
- MIME/type/サイズ検証
- アップロード中断時の再試行
- 可能なら`Idempotency-Key`対応

5. アプリライフサイクル対応
- `paused/inactive/resumed`で編集中データを即保存
- `resumed`時にセッション再検証

6. 状態ロスト防止
- "重要状態はメモリだけに置かない"を徹底
- 下書き、キュー、選択ファイル情報を永続化

---

## 9. Flutter実装チェックリスト（実機向け）

- [ ] `main_dev.dart`と`main_prod.dart`が分離されている
- [ ] `API_BASE_URL`がビルド時注入される
- [ ] 実機Releaseで起動から主要フローまで通る
- [ ] 認証情報が再起動後も復元される
- [ ] APIエラー時にクラッシュしない
- [ ] 画像/ファイル権限が`Info.plist`に定義済み
- [ ] 本番でHTTPS通信のみ
- [ ] Backendが環境変数だけで起動できる
- [ ] DBマイグレーション手順が確立済み

---

## 10. 最低限の運用ルール

- 開発中でも定期的に`--release`実機確認
- `prod`相当設定でのE2E確認を毎週実施
- APIログ/クラッシュログを確認する習慣を持つ
- "いまはlocalhostで動けばOK"の判断をしない

この方針で進めると、プロトタイプから個人常用アプリまでの移行コストを最小化できます。
