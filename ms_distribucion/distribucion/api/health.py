from django.http import JsonResponse
from django.db import connection
from django.conf import settings
import redis, time

def health(request):
    t0=time.time()
    # DB
    try:
        with connection.cursor() as c: c.execute("SELECT 1")
        db_ok = True
    except Exception as e:
        db_ok, db_err = False, str(e)
    # Redis (opcional)
    try:
        r = redis.Redis.from_url(settings.REDIS_DSN)
        r.ping()
        redis_ok = True
    except Exception as e:
        redis_ok, redis_err = False, str(e)

    status = 200 if (db_ok and redis_ok) else 503
    body = {"status":"ok" if status==200 else "degraded",
            "db": db_ok,
            "redis": redis_ok,
            "elapsed_ms": int((time.time()-t0)*1000)}
    if not db_ok: body["db_error"]=db_err
    if not redis_ok: body["redis_error"]=redis_err
    return JsonResponse(body, status=status)
