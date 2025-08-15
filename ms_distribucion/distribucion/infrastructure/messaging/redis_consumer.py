# distribucion/infrastructure/messaging/redis_consumer.py
from typing import Iterable, Mapping
import redis
from distribucion.application.ports import EventConsumer

class RedisEventConsumer(EventConsumer):  # ← implementa el puerto
    def __init__(self, dsn: str, stream: str, group: str, consumer: str, dlq_stream: str | None = None):
        self.r = redis.Redis.from_url(dsn, decode_responses=True, client_name="ms_distribucion_consumer")
        self.stream, self.group, self.consumer = stream, group, consumer
        self.dlq_stream = dlq_stream or f"{stream}.dlq"
        try:
            self.r.xgroup_create(stream, group, id="0", mkstream=True)
        except redis.ResponseError as e:
            if "BUSYGROUP" not in str(e):
                raise

    def read(self, count: int = 100, block_ms: int = 5000) -> Iterable[Mapping]:
        msgs = self.r.xreadgroup(self.group, self.consumer, {self.stream: ">"}, count=count, block=block_ms)
        if not msgs:
            return []
        _, batch = msgs[0]
        for mid, fields in batch:
            yield {"id": mid, "data": fields.get("data")}

    def ack(self, message_id: str) -> None:
        self.r.xack(self.stream, self.group, message_id)

    def dead_letter(self, payload: str, error: str) -> None:
        self.r.xadd(self.dlq_stream, {"data": payload, "error": str(error)[:500]})
