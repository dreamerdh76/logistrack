# distribucion/contracts/loader.py
from __future__ import annotations
from pathlib import Path
from typing import Dict, Any, Iterable
import json, os

CONTRACT_PREFIX = "https://contracts.logistrack/schemas/"

# 1) carpeta interna del app (fallback)
APP_SCHEMAS = Path(__file__).resolve().parent / "schemas"

# 2) repo externo hermano: <root>/logistrack-contracts/schemas (fallback)
ROOT = Path(__file__).resolve().parents[3]  # .../ms_distribucion/distribucion/contracts/loader.py
EXT_SCHEMAS = ROOT / "logistrack-contracts" / "schemas"

# 3) override por variable de entorno (preferida)
ENV_SCHEMAS = Path(os.environ["CONTRACTS_DIR"]) if os.environ.get("CONTRACTS_DIR") else None

def _uri_to_relpath(uri: str) -> str:
    """
    Convierte:
      https://contracts.logistrack/schemas/BloqueConsolidadoListo/1.2/schema.json
    en:
      BloqueConsolidadoListo/1.2/schema.json
    """
    if not uri.startswith(CONTRACT_PREFIX):
        raise FileNotFoundError(f"URI fuera de prefijo: {uri}")
    return uri[len(CONTRACT_PREFIX):]

def _bases() -> Iterable[Path]:
    # Orden de búsqueda: env → repo externo → carpeta interna
    if ENV_SCHEMAS:
        yield ENV_SCHEMAS
    yield EXT_SCHEMAS
    yield APP_SCHEMAS

def load_schema_by_uri(uri: str) -> Dict[str, Any]:
    rel = _uri_to_relpath(uri)
    tried = []
    for base in _bases():
        path = base / rel
        tried.append(str(path))
        if path.is_file():
            with path.open("r", encoding="utf-8") as f:
                return json.load(f)
    raise FileNotFoundError(f"No se reconoce el schema: {uri} | tried={tried}")
