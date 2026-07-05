from .base import *

DEBUG = False

ALLOWED_HOSTS = list(
    dict.fromkeys(
        [
            *env.list("ALLOWED_HOSTS", default=[]),
            "preplate.onrender.com",
            "preplate-1.onrender.com",
        ]
    )
)

CORS_ALLOW_ALL_ORIGINS = False

_EXTRA_CORS_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])
CORS_ALLOWED_ORIGINS = list(
    dict.fromkeys(
        [
            "http://localhost:3000",
            "https://preplate.onrender.com",
            "https://preplate-1.onrender.com",
            *_EXTRA_CORS_ORIGINS,
        ]
    )
)

_EXTRA_CSRF_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])
CSRF_TRUSTED_ORIGINS = list(
    dict.fromkeys(
        [
            "https://preplate.onrender.com",
            "https://preplate-1.onrender.com",
            *_EXTRA_CSRF_ORIGINS,
        ]
    )
)

SECURE_SSL_REDIRECT = True

SESSION_COOKIE_SECURE = True

CSRF_COOKIE_SECURE = True

SECURE_HSTS_SECONDS = 31536000

SECURE_HSTS_INCLUDE_SUBDOMAINS = True

SECURE_HSTS_PRELOAD = True

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
