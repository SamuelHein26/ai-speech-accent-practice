"""Helpers for storing accent training audio in S3 or a local fallback."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from .storage import S3Storage, S3StorageConfig, StorageError


class S3AudioStorage:
    """Store raw audio bytes in S3 (with a local fallback for development)."""

    def __init__(
        self,
        *,
        prefix: str = "accent-attempts",
        local_dir: Optional[Path | str] = None,
    ) -> None:
        config = S3StorageConfig.from_env()
        if prefix:
            base_prefix = config.prefix.rstrip("/") if config.prefix else ""
            accent_prefix = prefix.rstrip("/")
            config.prefix = (
                f"{base_prefix}/{accent_prefix}".strip("/")
                if base_prefix
                else accent_prefix
            )

        self._storage = S3Storage(config)
        self._local_dir = Path(local_dir or os.getenv("ACCENT_LOCAL_STORAGE", "./accent_attempts"))
        self._local_dir.mkdir(parents=True, exist_ok=True)

    def is_configured(self) -> bool:
        return self._storage.is_configured()

    def _write_local(self, object_key: str, data: bytes) -> str:
        destination = self._local_dir / object_key
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
        return str(destination)

    def put_object_bytes(
        self,
        object_key: str,
        data: bytes,
        *,
        content_type: str = "audio/webm",
    ) -> str:
        """Synchronously persist audio bytes and return the storage location."""

        if self.is_configured():
            return self._storage.put_object_bytes(
                object_key,
                data,
                content_type=content_type,
            )

        return self._write_local(object_key, data)

    async def store_bytes(
        self,
        object_key: str,
        data: bytes,
        *,
        content_type: str = "audio/webm",
    ) -> str:
        """Persist audio bytes and return the object key or local path."""

        if self.is_configured():
            try:
                return await self._storage.upload_audio_bytes(
                    object_key,
                    data,
                    content_type=content_type,
                )
            except StorageError:
                raise

        # Local development fallback
        return self._write_local(object_key, data)

    async def download_audio(self, stored_key: str) -> bytes:
        """Retrieve raw audio bytes regardless of backing store."""

        if self.is_configured():
            return await self._storage.download_audio(stored_key)

        path = Path(stored_key)
        if not path.is_absolute():
            path = self._local_dir / stored_key

        if not path.exists():
            raise StorageError("Audio file unavailable")

        return path.read_bytes()

    async def delete_audio(self, stored_key: str) -> None:
        """Delete the stored audio object from S3 or the local fallback."""

        if self.is_configured():
            await self._storage.delete_audio(stored_key)
            return

        path = Path(stored_key)
        if not path.is_absolute():
            path = self._local_dir / stored_key

        if path.exists():
            try:
                path.unlink()
            except OSError as exc:
                raise StorageError(f"Failed to delete stored audio: {exc}")

    def presigned_url(self, object_key: str, *, expires_in: int = 3600) -> str:
        if not self.is_configured():
            raise StorageError("S3 storage is not configured")

        return self._storage.generate_presigned_url(object_key, expiration=expires_in)
