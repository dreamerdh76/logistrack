from functools import lru_cache
from jsonschema import Draft202012Validator, FormatChecker
from .loader import load_schema_by_uri

class ContractError(Exception): ...

@lru_cache(maxsize=16)
def _validator_for(schema_uri: str) -> Draft202012Validator:
    schema = load_schema_by_uri(schema_uri)
    return Draft202012Validator(schema, format_checker=FormatChecker())

def validate_cloudevent(evt: dict) -> None:
    # Usa la misma URI que mapeas en tu loader (endswith .../cloudevent.json)
    uri = "https://contracts.logistrack/schemas/BloqueConsolidadoListo/1.0/cloudevent.json"
    try:
        _validator_for(uri).validate(evt)
    except Exception as e:
        # jsonschema lanza ValidationError u otras; re-envuélvelo
        raise ContractError(f"CloudEvent inválido: {e}")

def validate_data(data: dict, dataschema_uri: str) -> None:
    try:
        _validator_for(dataschema_uri).validate(data)
    except Exception as e:
        raise ContractError(f"Data inválida: {e}")
