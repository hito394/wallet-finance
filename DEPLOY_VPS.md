# VPSデプロイ手順（Docker Compose + Caddy）

この手順を完了すると、iPhoneからXcode不要で常時アクセスできます。

## 1. 事前準備

- ドメインを用意（例: `finance.example.com`）
- DNSのAレコードをVPSグローバルIPに向ける
- VPSにDocker / docker-composeをインストール

## 2. サーバーへ配置

```bash
# 例: /opt に配置
cd /opt
sudo git clone <your-repo-url> finance-app
cd finance-app
```

## 3. 環境変数設定

```bash
cp .env.compose.example .env
vi .env
```

`.env` で最低限変更する値:

- `DOMAIN`
- `LETSENCRYPT_EMAIL`
- `POSTGRES_PASSWORD`

## 4. 初回起動

```bash
docker-compose pull
docker-compose build --no-cache
docker-compose up -d
```

## 5. 動作確認

```bash
docker-compose ps
docker-compose logs -f caddy
docker-compose logs -f backend
```

ブラウザで以下を確認:

- `https://<DOMAIN>` が開く
- `https://<DOMAIN>/api/health` が `status: ok`

## 6. 更新手順

```bash
cd /opt/finance-app
git pull
docker-compose build
docker-compose up -d
```

## 7. バックアップ（推奨）

DBバックアップ:

```bash
docker-compose exec -T postgres pg_dump -U finance finance > backup_$(date +%F).sql
```

レシート/明細ファイルバックアップ:

```bash
docker run --rm -v finance-app_uploads_data:/data -v "$PWD":/backup alpine tar czf /backup/uploads_$(date +%F).tar.gz -C /data .
```

## 8. iPhoneで使う

1. Safariで `https://<DOMAIN>` を開く
2. 共有メニューから「ホーム画面に追加」
3. 以後はアプリ同様に起動

これでローカルPCを毎回起動しなくても利用できます。
