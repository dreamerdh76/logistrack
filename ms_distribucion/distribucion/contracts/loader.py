from pathlib import Path
from functools import lru_cache
import json
from django.conf import settings

CONTRACTS_DIR = Path(settings.LOGISTRACK_CONTRACTS_DIR)

@lru_cache(maxsize=32)
def load_schema_by_uri(uri: str) -> dict:

    schema_root = CONTRACTS_DIR / "schemas" / "BloqueConsolidadoListo" / "1.0"

    if uri.endswith("BloqueConsolidadoListo/1.0/schema.json"):
        return json.loads((schema_root / "schema.json").read_text(encoding="utf-8"))

    if uri.endswith("BloqueConsolidadoListo/1.0/cloudevent.json"):
        return json.loads((schema_root / "cloudevent.json").read_text(encoding="utf-8"))

    if uri.startswith("file://"):
        return json.loads(Path(uri[7:]).read_text(encoding="utf-8"))

    raise FileNotFoundError(f"No se reconoce el schema: {uri}")
