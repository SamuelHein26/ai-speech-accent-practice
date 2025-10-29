from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from typing import Optional
from pathlib import Path

import boto3
from botocore.exceptions import ClientError, BotoCoreError


class StorageError(RuntimeError):

@dataclass
class S3StorageConfig:
    bucket: Optional[str]
    region: Optional[str]
    access_key: Optional[str]
    secret_key: Optional[str]
    prefix: str
    endpoint_url: Optional[str] = None

    @classmethod
    def from_env(cls) -> "S3StorageConfig":
        prefix = os.getenv("S3_STORAGE_PREFIX", "recordings").strip()
        if prefix.endswith("/"):
            prefix = prefix[:-1]
        
        bucket = os.getenv("S3_BUCKET") or os.getenv("S3_BUCKET_NAME")
        region = os.getenv("AWS_REGION") or os.getenv("S3_REGION") or "us-east-1"

        return cls(
            bucket=bucket,
            region=region,
            access_key=os.getenv("AWS_ACCESS_KEY_ID"),
            secret_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            prefix=prefix,
            endpoint_url=os.getenv("S3_ENDPOINT_URL"),  # For S3-compatible services
        )

    def is_configured(self) -> bool:
        return bool(self.bucket and self.access_key and self.secret_key)


class S3Storage:

    def __init__(self, config: Optional[S3StorageConfig] = None):
        self.config = config or S3StorageConfig.from_env()
        self._client = None

    def _ensure_configured(self) -> None:
        if not self.is_configured():
            raise StorageError("S3 storage is not configured")

    def _get_client(self):
        if self._client is None:
            if not self.is_configured():
                raise StorageError("S3 storage is not configured")
            
            self._client = boto3.client(
                's3',
                aws_access_key_id=self.config.access_key,
                aws_secret_access_key=self.config.secret_key,
                region_name=self.config.region,
                endpoint_url=self.config.endpoint_url, 
            )
        return self._client

    def is_configured(self) -> bool:
        return self.config.is_configured()

    async def upload_audio(self, object_key: str, file_path: str) -> str:
        def _upload() -> str:
            self._ensure_configured()

            final_key = self._apply_prefix(object_key)
            client = self._get_client()

            try:
                client.upload_file(
                    file_path,
                    self.config.bucket,
                    final_key,
                    ExtraArgs={
                        'ContentType': 'audio/wav',
                        'ACL': 'private',
                    }
                )
                return final_key
            except (ClientError, BotoCoreError) as e:
                raise StorageError(f"S3 upload failed: {str(e)}")

        return await asyncio.to_thread(_upload)

    def put_object_bytes(
        self,
        object_key: str,
        data: bytes,
        *,
        content_type: str = "audio/webm",
    ) -> str:

        self._ensure_configured()

        final_key = self._apply_prefix(object_key)
        client = self._get_client()

        try:
            client.put_object(
                Bucket=self.config.bucket,
                Key=final_key,
                Body=data,
                ContentType=content_type,
            )
            return final_key
        except (ClientError, BotoCoreError) as e:
            raise StorageError(f"S3 upload failed: {str(e)}")

    async def upload_audio_bytes(
        self,
        object_key: str,
        data: bytes,
        *,
        content_type: str = "audio/webm",
    ) -> str:

        return await asyncio.to_thread(
            self.put_object_bytes,
            object_key,
            data,
            content_type=content_type,
        )

    def get_object_bytes(self, stored_key: str) -> bytes:

        self._ensure_configured()
        client = self._get_client()

        try:
            response = client.get_object(
                Bucket=self.config.bucket,
                Key=stored_key
            )
            return response['Body'].read()
        except (ClientError, BotoCoreError) as e:
            raise StorageError(f"S3 download failed: {str(e)}")

    async def download_audio(self, stored_key: str) -> bytes:

        return await asyncio.to_thread(self.get_object_bytes, stored_key)

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

    def delete_object(self, stored_key: str) -> None:

        self._ensure_configured()
        client = self._get_client()

        try:
            client.delete_object(
                Bucket=self.config.bucket,
                Key=stored_key,
            )
        except (ClientError, BotoCoreError) as e:
            raise StorageError(f"Failed to delete stored audio: {str(e)}")

    async def delete_audio(self, stored_key: str) -> None:

        await asyncio.to_thread(self.delete_object, stored_key)

    def _apply_prefix(self, object_key: str) -> str:
        key = object_key.lstrip("/")
        if not self.config.prefix:
            return key
        return f"{self.config.prefix}/{key}"
