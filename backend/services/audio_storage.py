"""Audio storage service.

Provides a single ``AudioStorage`` class that stores and retrieves audio
files from Supabase Storage (or any S3-compatible object storage) and falls
back to local disk when no cloud credentials are configured.

Configuration is done via environment variables:

  STORAGE_ENDPOINT_URL       Supabase S3 endpoint (e.g. https://<project>.storage.supabase.co/v1/s3)
  STORAGE_ACCESS_KEY_ID      Supabase S3 access key ID
  STORAGE_SECRET_ACCESS_KEY  Supabase S3 secret access key
  STORAGE_BUCKET             Storage bucket name (default: "recordings")
  STORAGE_REGION             Storage region (default: us-east-1)
  STORAGE_PREFIX             Key prefix inside bucket (default: "recordings")

  (Legacy S3_ENDPOINT_URL, S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
   and AWS_REGION are also supported as fallbacks).

  ACCENT_LOCAL_STORAGE Local fallback directory for accent attempt audio
                       when no cloud credentials are set (default: ./accent_attempts).
  SESSION_ARCHIVE_DIR  Local fallback directory for monologue session audio
                       (default: ./recordings).
"""

from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class StorageError(RuntimeError):
    """Raised for any storage-related error."""


# ---------------------------------------------------------------------------
# Internal configuration dataclass
# ---------------------------------------------------------------------------

@dataclass
class _StorageConfig:
    bucket: Optional[str]
    region: Optional[str]
    access_key: Optional[str]
    secret_key: Optional[str]
    prefix: str
    endpoint_url: Optional[str] = None

    @classmethod
    def from_env(cls, prefix_override: str | None = None) -> "_StorageConfig":
        raw_prefix = (
            os.getenv("STORAGE_PREFIX")
            or os.getenv("S3_STORAGE_PREFIX")
            or "recordings"
        ).strip().rstrip("/")
        prefix = prefix_override.rstrip("/") if prefix_override else raw_prefix
        return cls(
            bucket=(
                os.getenv("STORAGE_BUCKET")
                or os.getenv("S3_BUCKET_NAME")
                or os.getenv("S3_BUCKET")
            ),
            region=(
                os.getenv("STORAGE_REGION")
                or os.getenv("AWS_REGION")
                or os.getenv("S3_REGION")
                or "us-east-1"
            ),
            access_key=(
                os.getenv("STORAGE_ACCESS_KEY_ID")
                or os.getenv("AWS_ACCESS_KEY_ID")
            ),
            secret_key=(
                os.getenv("STORAGE_SECRET_ACCESS_KEY")
                or os.getenv("AWS_SECRET_ACCESS_KEY")
            ),
            prefix=prefix,
            endpoint_url=(
                os.getenv("STORAGE_ENDPOINT_URL")
                or os.getenv("S3_ENDPOINT_URL")
            ),
        )

    def is_configured(self) -> bool:
        return bool(self.bucket and self.access_key and self.secret_key)

    def prefixed(self, key: str) -> str:
        k = key.lstrip("/")
        return f"{self.prefix}/{k}" if self.prefix else k


# ---------------------------------------------------------------------------
# Public class
# ---------------------------------------------------------------------------

class AudioStorage:
    """Store and retrieve audio recordings from cloud storage or local disk.

    Instantiate once at module level and reuse across requests::

        storage = AudioStorage()

    When ``S3_BUCKET_NAME``, ``AWS_ACCESS_KEY_ID``, and
    ``AWS_SECRET_ACCESS_KEY`` are all set, files are stored in the configured
    S3-compatible bucket.  Otherwise, files are written to the local
    ``local_dir`` directory.

    Args:
        prefix:    Key prefix inside the bucket (e.g. ``"accent-attempts"``).
                   Defaults to the ``S3_STORAGE_PREFIX`` env var or ``"recordings"``.
        local_dir: Override the local fallback directory.
    """

    def __init__(
        self,
        *,
        prefix: str | None = None,
        local_dir: Path | str | None = None,
    ) -> None:
        self._config = _StorageConfig.from_env(prefix_override=prefix)
        self._client = None
        self._local_dir = Path(
            local_dir
            or os.getenv("SESSION_ARCHIVE_DIR", "./recordings")
        )
        self._local_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def is_configured(self) -> bool:
        """Return True if cloud credentials are present."""
        return self._config.is_configured()

    async def upload_file(self, object_key: str, file_path: str) -> str:
        """Upload a local file to cloud storage.  Returns the stored key."""
        return await asyncio.to_thread(self._upload_file_sync, object_key, file_path)

    async def upload_bytes(
        self,
        object_key: str,
        data: bytes,
        *,
        content_type: str = "audio/webm",
    ) -> str:
        """Upload raw bytes to cloud storage or write to local disk.

        Returns the stored key (cloud) or the local file path.
        """
        if self.is_configured():
            return await asyncio.to_thread(
                self._put_bytes_sync, object_key, data, content_type
            )
        return self._write_local(object_key, data)

    async def download(self, stored_key: str) -> bytes:
        """Download audio bytes from cloud storage or local disk."""
        if self.is_configured():
            return await asyncio.to_thread(self._get_bytes_sync, stored_key)

        path = Path(stored_key)
        if not path.is_absolute():
            path = self._local_dir / stored_key
        if not path.exists():
            raise StorageError("Audio file unavailable")
        return path.read_bytes()

    async def delete(self, stored_key: str) -> None:
        """Delete audio from cloud storage or local disk."""
        if self.is_configured():
            await asyncio.to_thread(self._delete_sync, stored_key)
            return

        path = Path(stored_key)
        if not path.is_absolute():
            path = self._local_dir / stored_key
        if path.exists():
            try:
                path.unlink()
            except OSError as exc:
                raise StorageError(f"Failed to delete audio: {exc}") from exc

    def presigned_url(self, stored_key: str, *, expires_in: int = 3600) -> str:
        """Generate a temporary pre-signed download URL."""
        if not self.is_configured():
            raise StorageError("Cloud storage is not configured")
        client = self._get_client()
        try:
            return client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self._config.bucket, "Key": stored_key},
                ExpiresIn=expires_in,
            )
        except (ClientError, BotoCoreError) as exc:
            raise StorageError(f"Failed to generate presigned URL: {exc}") from exc

    # ------------------------------------------------------------------
    # Internal sync helpers  (called via asyncio.to_thread)
    # ------------------------------------------------------------------

    def _get_client(self):
        if self._client is None:
            if not self.is_configured():
                raise StorageError("Cloud storage is not configured")
            self._client = boto3.client(
                "s3",
                aws_access_key_id=self._config.access_key,
                aws_secret_access_key=self._config.secret_key,
                region_name=self._config.region,
                endpoint_url=self._config.endpoint_url,
            )
        return self._client

    def _upload_file_sync(self, object_key: str, file_path: str) -> str:
        final_key = self._config.prefixed(object_key)
        try:
            self._get_client().upload_file(
                file_path,
                self._config.bucket,
                final_key,
                ExtraArgs={"ContentType": "audio/wav"},
            )
        except (ClientError, BotoCoreError) as exc:
            raise StorageError(f"Upload failed: {exc}") from exc
        return final_key

    def _put_bytes_sync(self, object_key: str, data: bytes, content_type: str) -> str:
        final_key = self._config.prefixed(object_key)
        try:
            self._get_client().put_object(
                Bucket=self._config.bucket,
                Key=final_key,
                Body=data,
                ContentType=content_type,
            )
        except (ClientError, BotoCoreError) as exc:
            raise StorageError(f"Upload failed: {exc}") from exc
        return final_key

    def _get_bytes_sync(self, stored_key: str) -> bytes:
        try:
            resp = self._get_client().get_object(
                Bucket=self._config.bucket, Key=stored_key
            )
            return resp["Body"].read()
        except (ClientError, BotoCoreError) as exc:
            raise StorageError(f"Download failed: {exc}") from exc

    def _delete_sync(self, stored_key: str) -> None:
        try:
            self._get_client().delete_object(
                Bucket=self._config.bucket, Key=stored_key
            )
        except (ClientError, BotoCoreError) as exc:
            raise StorageError(f"Delete failed: {exc}") from exc

    def _write_local(self, object_key: str, data: bytes) -> str:
        dest = self._local_dir / object_key
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return str(dest)
