"""Utility helpers for interacting with Supabase Storage."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

import httpx


class SupabaseStorageError(RuntimeError):
    """Raised when storage operations fail or storage is not configured."""


@dataclass
class SupabaseStorageConfig:
    url: Optional[str]
    key: Optional[str]
    bucket: Optional[str]
    prefix: str

    @classmethod
    def from_env(cls) -> "SupabaseStorageConfig":
        prefix = os.getenv("SUPABASE_STORAGE_PREFIX", "").strip()
        # Normalise prefix so that downstream joins are predictable.
        if prefix.endswith("/"):
            prefix = prefix[:-1]
        return cls(
            url=os.getenv("SUPABASE_URL"),
            key=(
                os.getenv("SUPABASE_SERVICE_ROLE_KEY")
                or os.getenv("SUPABASE_SERVICE_KEY")
                or os.getenv("SUPABASE_ANON_KEY")
            ),
            bucket=os.getenv("SUPABASE_STORAGE_BUCKET"),
            prefix=prefix,
        )

    def is_configured(self) -> bool:
        return bool(self.url and self.key and self.bucket)


class SupabaseStorage:
    """Thin async wrapper around the Supabase Storage HTTP API."""

    def __init__(self, config: Optional[SupabaseStorageConfig] = None):
        self.config = config or SupabaseStorageConfig.from_env()
        self._timeout = httpx.Timeout(30.0)

    # Public helpers -----------------------------------------------------------------
    def is_configured(self) -> bool:
        return self.config.is_configured()

    async def upload_audio(self, object_key: str, file_path: str) -> str:
        """
        Upload ``file_path`` to Supabase Storage and return the stored key.

        ``object_key`` should be a relative key (no leading slash). The optional
        ``SUPABASE_STORAGE_PREFIX`` is automatically prepended if provided.
        """

        if not self.is_configured():
            raise SupabaseStorageError("Supabase storage is not configured")

        final_key = self._apply_prefix(object_key)
        target_url = self._object_url(final_key)

        headers = {
            "Authorization": f"Bearer {self.config.key}",
            "Apikey": self.config.key or "",
            "Content-Type": "audio/wav",
            "x-upsert": "true",
        }

        # We read the file into memory because uploads happen after recording
        # completes and typical files are small (<10MB). This keeps the API
        # surface simple; revisit if recordings become significantly larger.
        with open(file_path, "rb") as fh:
            data = fh.read()

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(target_url, content=data, headers=headers)

        if response.is_error:
            raise SupabaseStorageError(
                f"Upload failed with status {response.status_code}: {response.text}"
            )

        return final_key

    async def download_audio(self, stored_key: str) -> bytes:
        """Fetch and return the raw audio bytes for ``stored_key``."""

        if not self.is_configured():
            raise SupabaseStorageError("Supabase storage is not configured")

        target_url = self._object_url(stored_key)
        headers = {
            "Authorization": f"Bearer {self.config.key}",
            "Apikey": self.config.key or "",
        }

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(target_url, headers=headers)

        if response.is_error:
            raise SupabaseStorageError(
                f"Download failed with status {response.status_code}: {response.text}"
            )

        return response.content

    # Internal helpers ---------------------------------------------------------------
    def _apply_prefix(self, object_key: str) -> str:
        key = object_key.lstrip("/")
        if not self.config.prefix:
            return key
        return f"{self.config.prefix}/{key}"

    def _object_url(self, object_key: str) -> str:
        if not self.config.url or not self.config.bucket:
            raise SupabaseStorageError("Supabase storage is not configured")
        key = object_key.lstrip("/")
        return f"{self.config.url}/storage/v1/object/{self.config.bucket}/{key}"

