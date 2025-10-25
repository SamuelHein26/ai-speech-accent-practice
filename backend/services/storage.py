"""Storage service for S3-compatible storage."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional
from pathlib import Path

import boto3
from botocore.exceptions import ClientError, BotoCoreError


class StorageError(RuntimeError):
    """Raised when storage operations fail or storage is not configured."""


@dataclass
class S3StorageConfig:
    bucket: Optional[str]
    region: Optional[str]
    access_key: Optional[str]
    secret_key: Optional[str]
    prefix: str
    # Optional: if you want to use a custom endpoint (like MinIO, DigitalOcean Spaces, etc.)
    endpoint_url: Optional[str] = None

    @classmethod
    def from_env(cls) -> "S3StorageConfig":
        prefix = os.getenv("S3_STORAGE_PREFIX", "recordings").strip()
        # Normalize prefix so that downstream joins are predictable.
        if prefix.endswith("/"):
            prefix = prefix[:-1]
        
        return cls(
            bucket=os.getenv("S3_BUCKET_NAME"),
            region=os.getenv("S3_REGION", "us-east-1"),
            access_key=os.getenv("AWS_ACCESS_KEY_ID"),
            secret_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            prefix=prefix,
            endpoint_url=os.getenv("S3_ENDPOINT_URL"),  # For S3-compatible services
        )

    def is_configured(self) -> bool:
        return bool(self.bucket and self.access_key and self.secret_key)


class S3Storage:
    """Async wrapper around boto3 S3 operations."""

    def __init__(self, config: Optional[S3StorageConfig] = None):
        self.config = config or S3StorageConfig.from_env()
        self._client = None

    def _get_client(self):
        """Lazy initialization of S3 client."""
        if self._client is None:
            if not self.is_configured():
                raise StorageError("S3 storage is not configured")
            
            self._client = boto3.client(
                's3',
                aws_access_key_id=self.config.access_key,
                aws_secret_access_key=self.config.secret_key,
                region_name=self.config.region,
                endpoint_url=self.config.endpoint_url,  # None for standard AWS S3
            )
        return self._client

    def is_configured(self) -> bool:
        return self.config.is_configured()

    async def upload_audio(self, object_key: str, file_path: str) -> str:
        """
        Upload file_path to S3 and return the stored key.
        
        object_key should be a relative key (no leading slash). The optional
        S3_STORAGE_PREFIX is automatically prepended if provided.
        """
        if not self.is_configured():
            raise StorageError("S3 storage is not configured")

        final_key = self._apply_prefix(object_key)
        client = self._get_client()

        try:
            # Upload with appropriate metadata
            client.upload_file(
                file_path,
                self.config.bucket,
                final_key,
                ExtraArgs={
                    'ContentType': 'audio/wav',
                    'ACL': 'private',  # Keep files private, use presigned URLs
                }
            )
            return final_key
        except (ClientError, BotoCoreError) as e:
            raise StorageError(f"S3 upload failed: {str(e)}")

    async def download_audio(self, stored_key: str) -> bytes:
        """Fetch and return the raw audio bytes for stored_key."""
        if not self.is_configured():
            raise StorageError("S3 storage is not configured")

        client = self._get_client()

        try:
            response = client.get_object(
                Bucket=self.config.bucket,
                Key=stored_key
            )
            return response['Body'].read()
        except (ClientError, BotoCoreError) as e:
            raise StorageError(f"S3 download failed: {str(e)}")

    def generate_presigned_url(self, stored_key: str, expiration: int = 3600) -> str:
        if not self.is_configured():
            raise StorageError("S3 storage is not configured")

        client = self._get_client()

        try:
            url = client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.config.bucket,
                    'Key': stored_key
                },
                ExpiresIn=expiration
            )
            return url
        except (ClientError, BotoCoreError) as e:
            raise StorageError(f"Failed to generate presigned URL: {str(e)}")

    async def delete_audio(self, stored_key: str) -> None:
        """Delete the object identified by stored_key from storage."""
        if not self.is_configured():
            raise StorageError("S3 storage is not configured")

        client = self._get_client()

        try:
            client.delete_object(
                Bucket=self.config.bucket,
                Key=stored_key,
            )
        except (ClientError, BotoCoreError) as e:
            raise StorageError(f"Failed to delete stored audio: {str(e)}")

    def _apply_prefix(self, object_key: str) -> str:
        """Apply the configured prefix to the object key."""
        key = object_key.lstrip("/")
        if not self.config.prefix:
            return key
        return f"{self.config.prefix}/{key}"