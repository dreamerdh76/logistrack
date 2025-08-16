# Modelo de Datos – LogisTrack (Mermaid)

## ERD (erDiagram – compatible con GitHub)
```mermaid
erDiagram
  PYME {
    char64 id PK
    varchar200 nombre
  }

  CENTRO_DISTRIBUCION {
    char64 id PK
    varchar200 nombre
    enum tipo
    char64 pyme_asociada FK NULL
  }

  CHOFER {
    uuid id PK
    varchar200 nombre
  }

  PRODUCTO {
    uuid id PK
    varchar64 sku UK
    varchar200 nombre
    bool activo
  }

  ORDEN {
    char64 id PK
    char64 pyme_id FK
    char64 origen_cd_id FK
    char64 destino_cd_id FK
    datetime fecha_despacho
    enum estado_preparacion
    decimal12_3 peso_total
    decimal12_6 volumen_total
    uuid chofer_id FK NULL
  }

  ORDEN_PRODUCTO {
    bigint id PK
    char64 orden_id FK
    uuid producto_id FK
    uint qty
    decimal12_3 peso
    decimal12_6 volumen
    UK orden_id_producto_id
  }

  BOLSA {
    uuid id PK
    varchar64 codigo UK
    char64 orden_id FK
    decimal12_3 peso
    decimal12_6 volumen
    bool preparada
    datetime fecha_preparacion NULL
    varchar120 usuario_preparador NULL
  }

  BLOQUE {
    char64 id PK
    datetime fecha
    uuid chofer_id FK
    varchar200 chofer_nombre
    uint total_ordenes
    enum estado_completitud
  }

  BLOQUE_ORDEN {
    bigint id PK
    char64 bloque_id FK
    char64 orden_id FK
    UK bloque_id_orden_id
  }

  RECEPCION {
    bigint id PK
    char64 orden_id FK UK
    char64 cd_id FK
    datetime fecha_recepcion
    varchar120 usuario_receptor
    bool incidencias
  }

  DISTRIBUCION {
    bigint id PK
    char64 orden_id FK UK
    enum estado
    datetime fecha_entrega NULL
    uuid chofer_id FK NULL
  }

  EVENT_OFFSET {
    varchar128 event_id PK
    datetime processed_at
  }

  PYME ||--o{ CENTRO_DISTRIBUCION : tiene_centros
  PYME ||--o{ ORDEN : genera_ordenes

  CENTRO_DISTRIBUCION ||--o{ ORDEN : es_origen
  CENTRO_DISTRIBUCION ||--o{ ORDEN : es_destino

  CHOFER ||--o{ ORDEN : asignado_a
  ORDEN ||--o{ ORDEN_PRODUCTO : tiene_lineas
  PRODUCTO ||--o{ ORDEN_PRODUCTO : aparece_en_lineas

  ORDEN ||--o{ BOLSA : tiene_bolsas

  CHOFER ||--o{ BLOQUE : conduce_bloques
  BLOQUE ||--o{ BLOQUE_ORDEN : agrupa_ordenes
  ORDEN ||--o{ BLOQUE_ORDEN : pertenece_a_bloques

  ORDEN ||--|| RECEPCION : tiene_recepcion
  CENTRO_DISTRIBUCION ||--o{ RECEPCION : recibe_ordenes

  ORDEN ||--|| DISTRIBUCION : tiene_entrega
  CHOFER ||--o{ DISTRIBUCION : realiza_entregas
```

## Vista alternativa (classDiagram – fallback)
```mermaid
classDiagram
  class Pyme {
    +id: char(64)
    +nombre: varchar(200)
  }

  class CentroDistribucion {
    +id: char(64)
    +nombre: varchar(200)
    +tipo: enum CD|CAP
    +pyme_asociada: char(64) [0..1]
  }

  class Chofer {
    +id: uuid
    +nombre: varchar(200)
  }

  class Producto {
    +id: uuid
    +sku: varchar(64) <<unique>>
    +nombre: varchar(200)
    +activo: bool
  }

  class Orden {
    +id: char(64)
    +pyme_id: char(64)
    +origen_cd_id: char(64)
    +destino_cd_id: char(64)
    +fecha_despacho: datetime
    +estado_preparacion: enum PEN|COM
    +peso_total: decimal(12,3)
    +volumen_total: decimal(12,6)
    +chofer_id: uuid [0..1]
  }

  class OrdenProducto {
    +id: bigint
    +orden_id: char(64)
    +producto_id: uuid
    +qty: uint
    +peso: decimal(12,3)
    +volumen: decimal(12,6)
    <<unique (orden_id, producto_id)>>
  }

  class Bolsa {
    +id: uuid
    +codigo: varchar(64) <<unique>>
    +orden_id: char(64)
    +peso: decimal(12,3)
    +volumen: decimal(12,6)
    +preparada: bool
    +fecha_preparacion: datetime [0..1]
    +usuario_preparador: varchar(120) [0..1]
  }

  class Bloque {
    +id: char(64)
    +fecha: datetime
    +chofer_id: uuid
    +chofer_nombre: varchar(200)
    +total_ordenes: uint
    +estado_completitud: enum INC|COM
  }

  class BloqueOrden {
    +id: bigint
    +bloque_id: char(64)
    +orden_id: char(64)
    <<unique (bloque_id, orden_id)>>
  }

  class Recepcion {
    +id: bigint
    +orden_id: char(64) <<unique>>
    +cd_id: char(64)
    +fecha_recepcion: datetime
    +usuario_receptor: varchar(120)
    +incidencias: bool
  }

  class Distribucion {
    +id: bigint
    +orden_id: char(64) <<unique>>
    +estado: enum PEN|ENT|REJ
    +fecha_entrega: datetime [0..1]
    +chofer_id: uuid [0..1]
  }

  class EventOffset {
    +event_id: varchar(128)
    +processed_at: datetime
  }

  Pyme "1" --> "0..*" CentroDistribucion : pyme_asociada
  Pyme "1" --> "0..*" Orden

  CentroDistribucion "1" --> "0..*" Orden : origen
  CentroDistribucion "1" --> "0..*" Orden : destino

  Chofer "1" --> "0..*" Orden : chofer

  Orden "1" --> "0..*" OrdenProducto
  Producto "1" --> "0..*" OrdenProducto

  Orden "1" --> "0..*" Bolsa

  Chofer "1" --> "0..*" Bloque : chofer

  Bloque "1" --> "0..*" BloqueOrden
  Orden "1" --> "0..*" BloqueOrden

  Orden "1" --> "1" Recepcion
  CentroDistribucion "1" --> "0..*" Recepcion : cd

  Orden "1" --> "1" Distribucion
  Chofer "1" --> "0..*" Distribucion : chofer
```
