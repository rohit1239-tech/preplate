from fnmatch import fnmatch
from unittest import TestCase
from unittest.mock import patch

from config.cache import UpstashRedisCache


class FakeUpstashRedis:
    def __init__(self, *args, **kwargs):
        self.store = {}

    def set(self, key, value, nx=None, ex=None):
        if nx and key in self.store:
            return None
        self.store[key] = value
        return True

    def get(self, key):
        return self.store.get(key)

    def delete(self, *keys):
        deleted = 0
        for key in keys:
            if key in self.store:
                deleted += 1
                del self.store[key]
        return deleted

    def exists(self, key):
        return int(key in self.store)

    def expire(self, key, seconds):
        return int(key in self.store)

    def scan(self, cursor, match=None, count=None):
        keys = [key for key in self.store if match is None or fnmatch(key, match)]
        return 0, keys


class UpstashRedisCacheTests(TestCase):
    def make_cache(self):
        with patch("config.cache.Redis", FakeUpstashRedis):
            return UpstashRedisCache(
                "https://example.upstash.io",
                {
                    "KEY_PREFIX": "preplate",
                    "OPTIONS": {"TOKEN": "test-token"},
                },
            )

    def test_round_trips_django_cache_values(self):
        cache = self.make_cache()

        cache.set("otp:meta:user@example.com", {"resend_count": 1}, timeout=300)

        self.assertEqual(
            cache.get("otp:meta:user@example.com"),
            {"resend_count": 1},
        )

    def test_add_only_writes_missing_key(self):
        cache = self.make_cache()

        self.assertTrue(cache.add("otp:lock:user@example.com", "1", timeout=5))
        self.assertFalse(cache.add("otp:lock:user@example.com", "2", timeout=5))

        self.assertEqual(cache.get("otp:lock:user@example.com"), "1")

    def test_incr_uses_decoded_integer_value(self):
        cache = self.make_cache()
        cache.set("otp:failed:user@example.com", 1, timeout=3600)

        self.assertEqual(cache.incr("otp:failed:user@example.com"), 2)
        self.assertEqual(cache.get("otp:failed:user@example.com"), 2)

    def test_clear_removes_only_prefixed_cache_keys(self):
        cache = self.make_cache()
        cache.set("otp:value:user@example.com", "123456", timeout=300)
        cache._client.store["other:1:otp:value:user@example.com"] = "keep"

        self.assertTrue(cache.clear())

        self.assertIsNone(cache.get("otp:value:user@example.com"))
        self.assertIn("other:1:otp:value:user@example.com", cache._client.store)
