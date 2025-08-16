flowchart LR
  user[Usuario] -->|HTTP| web[Angular SPA (logistrack-web)]

  subgraph Django [ms_distribucion (Django/DRF)]
    apiD[REST API\n/despacho /preparacion /consolidacion /recepcion /expedicion]
    pg[(PostgreSQL)]
    apiD --> pg
  end

  subgraph Symfony [Backend Symfony (MySQL)]
    apiS[API / Productor de eventos]
    mysql[(MySQL)]
    apiS --> mysql
  end

  subgraph Infra
    redis[(Redis Streams)]
    contracts[Contracts JSON Schema\n($CONTRACTS_DIR)]
  end

  web -->|REST JSON| apiD
  %% (si tu web también habla directo a Symfony, añade:)
  %% web -->|REST JSON| apiS

  apiS -. produce CloudEvent v2 .-> redis
  redis -. consumer: manage.py consume_distribucion .-> apiD
  apiD -. valida CE (jsonschema) .-> contracts


sequenceDiagram
  participant SY as Symfony
  participant RS as Redis Stream
  participant DJ as ms_distribucion
  participant DB as PostgreSQL

  SY->>RS: XADD BloqueConsolidadoListo (CE v2)
  DJ->>RS: XREADGROUP (consume_distribucion)
  DJ->>DJ: validate_cloudevent()/jsonschema
  DJ->>DB: upsert bloque/ordenes + link + set incompleto
  DJ-->>RS: XACK