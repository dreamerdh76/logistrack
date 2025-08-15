# distribucion/contracts/validator.py
from __future__ import annotations
from functools import lru_cache
from typing import Dict, Any, Set
from jsonschema import Draft202012Validator, FormatChecker, RefResolver

from .loader import load_schema_by_uri, CONTRACT_PREFIX

class ContractError(Exception): ...

def _collect_remote_refs(schema: Any) -> Set[str]:
    found: Set[str] = set()
    def walk(node: Any):
        if isinstance(node, dict):
            ref = node.get("$ref")
            if isinstance(ref, str) and ref.startswith(CONTRACT_PREFIX):
                found.add(ref.split("#", 1)[0])
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node: walk(v)
    walk(schema)
    return found

def _make_validator(schema_uri: str,
                    extra_store: Dict[str, Dict[str, Any]] | None = None) -> Draft202012Validator:
    schema = load_schema_by_uri(schema_uri)

    # Pre-carga $ref remotos que aparezcan dentro del schema
    store: Dict[str, Dict[str, Any]] = {}
    for ref_uri in _collect_remote_refs(schema):
        try:
            store[ref_uri] = load_schema_by_uri(ref_uri)
        except FileNotFoundError:
            pass  # si no existe localmente, lo resolverá el handler

    # Mezcla extras (p.ej. dataschema del evento)
    if extra_store:
        for k, v in extra_store.items():
            base = k.split("#", 1)[0]
            store[k] = v
            store[base] = v

    # Handlers: nunca ir a internet, resolver siempre con loader local
    handlers = {
        "https": lambda uri: load_schema_by_uri(uri.split("#", 1)[0]),
        "http":  lambda uri: load_schema_by_uri(uri.split("#", 1)[0]),
    }

    resolver = RefResolver.from_schema(schema, store=store, handlers=handlers)
    return Draft202012Validator(schema, resolver=resolver, format_checker=FormatChecker())

@lru_cache(maxsize=16)
def _validator_for(schema_uri: str) -> Draft202012Validator:
    return _make_validator(schema_uri)

def validate_cloudevent(evt: dict) -> None:
    # CE v2.0 local
    ce_uri = "https://contracts.logistrack/schemas/BloqueConsolidadoListo/2.0/cloudevent.json"

    # Si el CE schema tiene $ref a dataschema, le pasamos el schema de data en el store
    extra_store: Dict[str, Dict[str, Any]] = {}
    ds = evt.get("dataschema")
    if isinstance(ds, str):
        try:
            extra_store[ds] = load_schema_by_uri(ds)
        except FileNotFoundError as e:
            # Error claro y offline (no intentes ir a la red)
            raise ContractError(
                "CloudEvent inválido: dataschema no disponible localmente. "
                f"{e}"
            )

    try:
        validator = _make_validator(ce_uri, extra_store=extra_store)
        validator.validate(evt)
    except Exception as e:
        raise ContractError(f"CloudEvent inválido: {e}")

def validate_data(data: dict, dataschema_uri: str) -> None:
    try:
        _validator_for(dataschema_uri).validate(data)
    except Exception as e:
        raise ContractError(f"Data inválida: {e}")
