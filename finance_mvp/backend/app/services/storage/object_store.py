"""
Thin wrapper around boto3 for S3-compatible object storage (AWS S3 / Cloudflare R2).

Usage:
  from app.services.storage.object_store import upload_file, resolve_to_local_path

All public functions are no-ops / fall back to local paths when object storage is
not configured (S3_BUCKET env var is absent).
"""
from __future__ import annotations

import contextlib
import tempfile
from pathlib import Path
from typing import Generator


# ── S3 URI helpers ────────────────────────────────────────────────────────────

S3_SCHEME = "s3://"


def is_s3_uri(uri: str) -> bool:
    return uri.startswith(S3_SCHEME)


def _parse_s3_uri(uri: str) -> tuple[str, str]:
    """Return (bucket, key) from 's3://bucket/key'."""
    without_scheme = uri[len(S3_SCHEME):]
    bucket, _, key = without_scheme.partition("/")
    return bucket, key


def _make_s3_uri(bucket: str, key: str) -> str:
    return f"{S3_SCHEME}{bucket}/{key}"


# ── boto3 client (lazy) ───────────────────────────────────────────────────────

def _get_client():  # type: ignore[return]
    import boto3  # type: ignore[import-untyped]
    from app.core.config import settings

    kwargs: dict = {
        "aws_access_key_id": settings.s3_access_key_id,
        "aws_secret_access_key": settings.s3_secret_access_key,
        "region_name": settings.s3_region,
    }
    if settings.s3_endpoint_url:
        kwargs["endpoint_url"] = settings.s3_endpoint_url

    return boto3.client("s3", **kwargs)


# ── Public API ────────────────────────────────────────────────────────────────

def upload_file(local_path: Path, key: str) -> str:
    """Upload *local_path* to the configured bucket under *key*.

    Returns the s3:// URI.  Raises RuntimeError if object storage is not
    configured.
    """
    from app.core.config import settings

    if not settings.object_storage_enabled:
        raise RuntimeError("Object storage is not configured (S3_BUCKET env var missing)")

    client = _get_client()
    client.upload_file(str(local_path), settings.s3_bucket, key)
    return _make_s3_uri(settings.s3_bucket, key)


@contextlib.contextmanager
def resolve_to_local_path(storage_uri: str) -> Generator[Path, None, None]:
    """Context manager that yields a local Path for *storage_uri*.

    - If *storage_uri* is already a local path, yields it directly (no cleanup).
    - If it is an s3:// URI, downloads to a temp file and deletes it on exit.
    """
    if not is_s3_uri(storage_uri):
        yield Path(storage_uri)
        return

    bucket, key = _parse_s3_uri(storage_uri)
    suffix = Path(key).suffix or ".bin"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp_path = Path(tmp.name)

    try:
        client = _get_client()
        client.download_file(bucket, key, str(tmp_path))
        yield tmp_path
    finally:
        with contextlib.suppress(OSError):
            tmp_path.unlink()
