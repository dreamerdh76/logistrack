import os, pytest
from django.conf import settings

@pytest.fixture(autouse=True, scope="session")
def _test_settings():

    settings.DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
            # claves que Django espera:
            "ATOMIC_REQUESTS": False,
            "AUTOCOMMIT": True,
            "CONN_MAX_AGE": 0,
            "OPTIONS": {},
            "TIME_ZONE": "UTC",  # opcional
        }
    }
    settings.LOG_LEVEL = "ERROR"
    settings.REDIS_DSN = os.getenv("REDIS_DSN", "redis://127.0.0.1:6379/0")
    settings.REDIS_STREAM = "distribucion.bloques"
    settings.REDIS_GROUP = "grp.distribucion"
    settings.REDIS_CONSUMER = "test-consumer"
    settings.DLQ_STREAM = "ms.dlq.distribucion"
    settings.XREAD_COUNT = 100
    settings.XREAD_BLOCK_MS = 250
