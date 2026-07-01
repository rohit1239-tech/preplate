import base64
import pickle
from typing import Any

from django.core.cache.backends.base import DEFAULT_TIMEOUT, BaseCache
from upstash_redis import Redis


class UpstashRedisCache(BaseCache):
    """Django cache backend using Upstash Redis REST API."""

    payload_prefix = "pickle:v1:"

    def __init__(self, server: str, params: dict[str, Any]) -> None:
        super().__init__(params)
        options = params.get("OPTIONS", {})
        token = options.get("TOKEN")
        if not server or not token:
            raise ValueError(
                "UpstashRedisCache requires LOCATION and OPTIONS['TOKEN']."
            )
        self._client = Redis(
            url=server,
            token=token,
            rest_retries=int(options.get("REST_RETRIES", 1)),
            rest_retry_interval=float(options.get("REST_RETRY_INTERVAL", 3)),
            allow_telemetry=bool(options.get("ALLOW_TELEMETRY", False)),
        )

    def add(
        self,
        key: str,
        value: Any,
        timeout: object = DEFAULT_TIMEOUT,
        version: int | None = None,
    ) -> bool:
        key = self.make_and_validate_key(key, version=version)
        ttl = self._ttl(timeout)
        if ttl == 0:
            return False
        response = self._client.set(key, self._encode(value), nx=True, ex=ttl)
        return bool(response)

    def get(self, key: str, default: Any = None, version: int | None = None) -> Any:
        key = self.make_and_validate_key(key, version=version)
        value = self._client.get(key)
        if value is None:
            return default
        return self._decode(value)

    def set(
        self,
        key: str,
        value: Any,
        timeout: object = DEFAULT_TIMEOUT,
        version: int | None = None,
    ) -> bool:
        key = self.make_and_validate_key(key, version=version)
        ttl = self._ttl(timeout)
        if ttl == 0:
            self._client.delete(key)
            return False
        response = self._client.set(key, self._encode(value), ex=ttl)
        return bool(response)

    def touch(
        self,
        key: str,
        timeout: object = DEFAULT_TIMEOUT,
        version: int | None = None,
    ) -> bool:
        key = self.make_and_validate_key(key, version=version)
        ttl = self._ttl(timeout)
        if ttl is None:
            return bool(self._client.exists(key))
        if ttl == 0:
            return bool(self._client.delete(key))
        return bool(self._client.expire(key, ttl))

    def delete(self, key: str, version: int | None = None) -> bool:
        key = self.make_and_validate_key(key, version=version)
        return bool(self._client.delete(key))

    def clear(self) -> bool:
        pattern = self.make_key("*")
        cursor = 0
        while True:
            cursor, keys = self._client.scan(cursor, match=pattern, count=100)
            if keys:
                self._client.delete(*keys)
            if int(cursor) == 0:
                return True

    def _ttl(self, timeout: object = DEFAULT_TIMEOUT) -> int | None:
        if timeout == DEFAULT_TIMEOUT:
            timeout = self.default_timeout
        if timeout is None:
            return None
        timeout = int(timeout)
        return max(timeout, 0)

    def _encode(self, value: Any) -> str:
        payload = pickle.dumps(value, protocol=pickle.HIGHEST_PROTOCOL)
        return self.payload_prefix + base64.b64encode(payload).decode("ascii")

    def _decode(self, value: Any) -> Any:
        if isinstance(value, str) and value.startswith(self.payload_prefix):
            payload = base64.b64decode(value.removeprefix(self.payload_prefix))
            return pickle.loads(payload)
        return value
