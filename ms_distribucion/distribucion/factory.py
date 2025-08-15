# distribucion/factory.py
from __future__ import annotations
import random
import uuid
from decimal import Decimal
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from faker import Faker

from .models import (
    Chofer, Pyme, CentroDistribucion, Producto,
    Orden, OrdenProducto, Recepcion, Distribucion,
    EstadoPreparacion, EstadoDistribucion
)

fake = Faker("es_ES")
random.seed()
Faker.seed()

TARGET = 30  # elementos por tabla

# ---------- utilidades ----------
def _rid(prefix: str = "", size: int = 12) -> str:
    return (prefix + uuid.uuid4().hex)[:size]

def _rand_dec(a: float, b: float, q: str = "0.001") -> Decimal:
    return Decimal(str(random.uniform(a, b))).quantize(Decimal(q))

def _sample_dt(past_days=30, future_days=5) -> timezone.datetime:
    now = timezone.now()
    d = random.randint(-past_days, future_days)
    s = random.randint(0, 60 * 60 * 20)
    return now + timedelta(days=d, seconds=s)

# ---------- seeding ----------
@transaction.atomic
def run(verbose: bool = True):
    # ---- Chofer (UUID PK) ----
    ch_count = Chofer.objects.count()
    if verbose: print(f"[seed] Chofer: {ch_count} existentes")
    if ch_count < TARGET:
        Chofer.objects.bulk_create([
            Chofer(nombre=fake.name())
            for _ in range(TARGET - ch_count)
        ])
    choferes = list(Chofer.objects.all())

    # ---- Pyme (Char PK) ----
    py_count = Pyme.objects.count()
    if verbose: print(f"[seed] Pyme: {py_count} existentes")
    if py_count < TARGET:
        Pyme.objects.bulk_create([
            Pyme(id=_rid("py_"), nombre=fake.company())
            for _ in range(TARGET - py_count)
        ], ignore_conflicts=True)
    pymes = list(Pyme.objects.all())

    # ---- CentroDistribucion (Char PK) ----
    cd_count = CentroDistribucion.objects.count()
    if verbose: print(f"[seed] CentroDistribucion: {cd_count} existentes")
    if cd_count < TARGET:
        CentroDistribucion.objects.bulk_create([
            CentroDistribucion(id=_rid("cd_"),
                               nombre=f"{fake.city()} CD {cd_count + i + 1}")
            for i in range(TARGET - cd_count)
        ], ignore_conflicts=True)
    cds = list(CentroDistribucion.objects.all())

    # ---- Producto (UUID PK, sku único) ----
    pr_count = Producto.objects.count()
    if verbose: print(f"[seed] Producto: {pr_count} existentes")
    if pr_count < TARGET:
        nuevos = []
        for i in range(TARGET - pr_count):
            sku = f"SKU-{uuid.uuid4().hex[:10].upper()}"
            nuevos.append(Producto(sku=sku, nombre=fake.word().capitalize()))
        Producto.objects.bulk_create(nuevos, ignore_conflicts=True)
    productos = list(Producto.objects.all())

    # ---- Orden (FKs a Pyme, CD, Chofer) ----
    ord_count = Orden.objects.count()
    if verbose: print(f"[seed] Orden: {ord_count} existentes")
    if ord_count < TARGET:
        nuevos = []
        for _ in range(TARGET - ord_count):
            py = random.choice(pymes)
            o_cd, d_cd = random.sample(cds, 2)  # origen != destino
            fecha = _sample_dt(30, 0)
            nuevos.append(Orden(
                id=_rid("ord_", 18),
                pyme=py,
                origen_cd=o_cd,
                destino_cd=d_cd,
                fecha_despacho=fecha,
                estado_preparacion=random.choice([
                    EstadoPreparacion.PENDIENTE, EstadoPreparacion.COMPLETA
                ]),
                peso_total=_rand_dec(1, 120, "0.001"),
                volumen_total=_rand_dec(0.01, 2.0, "0.000001"),
                chofer=random.choice([None] * 2 + [random.choice(choferes)]),
            ))
        Orden.objects.bulk_create(nuevos)
    # refrescamos con relaciones
    ordenes = list(Orden.objects.select_related("origen_cd", "destino_cd", "pyme"))

    # ---- OrdenProducto (unique_together: orden + producto) ----
    op_count = OrdenProducto.objects.count()
    if verbose: print(f"[seed] OrdenProducto: {op_count} existentes")
    if op_count < TARGET and ordenes and productos:
        faltan = TARGET - op_count
        usados = set(OrdenProducto.objects.values_list("orden_id", "producto_id"))
        nuevos = []
        for _ in range(faltan):
            o = random.choice(ordenes)
            # evitar colisión orden-producto
            for _try in range(5):
                p = random.choice(productos)
                key = (o.id, p.id)
                if key not in usados:
                    usados.add(key)
                    nuevos.append(OrdenProducto(
                        orden=o,
                        producto=p,
                        qty=random.randint(1, 12),
                        peso=_rand_dec(0.1, 10, "0.001"),
                        volumen=_rand_dec(0.001, 0.2, "0.000001"),
                    ))
                    break
        if nuevos:
            OrdenProducto.objects.bulk_create(nuevos, ignore_conflicts=True)

    # ---- Recepcion (OneToOne con Orden) ----
    rc_count = Recepcion.objects.count()
    if verbose: print(f"[seed] Recepcion: {rc_count} existentes")
    if rc_count < TARGET:
        existentes = set(Recepcion.objects.values_list("orden_id", flat=True))
        candidatos = [o for o in ordenes if o.id not in existentes]
        random.shuffle(candidatos)
        nuevos = []
        for o in candidatos[:TARGET - rc_count]:
            cd = random.choice([o.origen_cd, o.destino_cd])
            fecha_rc = o.fecha_despacho + timedelta(hours=random.randint(2, 48))
            nuevos.append(Recepcion(
                orden=o,
                cd=cd,
                fecha_recepcion=fecha_rc,
                usuario_receptor=fake.user_name(),
                incidencias=random.choice([True] + [False] * 3),
            ))
        if nuevos:
            Recepcion.objects.bulk_create(nuevos, ignore_conflicts=True)

    # ---- Distribucion (OneToOne con Orden) ----
    ds_count = Distribucion.objects.count()
    if verbose: print(f"[seed] Distribucion: {ds_count} existentes")
    if ds_count < TARGET:
        existentes = set(Distribucion.objects.values_list("orden_id", flat=True))
        candidatos = [o for o in ordenes if o.id not in existentes]
        random.shuffle(candidatos)
        nuevos = []
        for o in candidatos[:TARGET - ds_count]:
            estado = random.choices(
                population=[EstadoDistribucion.PENDIENTE, EstadoDistribucion.ENTREGADA, EstadoDistribucion.RECHAZADA],
                weights=[0.35, 0.55, 0.10],
                k=1
            )[0]
            fecha_entrega = None
            if estado == EstadoDistribucion.ENTREGADA:
                base_dt = getattr(getattr(o, "recepcion", None), "fecha_recepcion", o.fecha_despacho)
                fecha_entrega = base_dt + timedelta(hours=random.randint(1, 48))
            nuevos.append(Distribucion(
                orden=o,
                estado=estado,
                fecha_entrega=fecha_entrega,
                chofer=random.choice([None] + choferes),
            ))
        if nuevos:
            Distribucion.objects.bulk_create(nuevos, ignore_conflicts=True)

    if verbose:
        print("[seed] Listo ✅")
        print_summary()

def print_summary():
    print(
        "\nResumen:\n"
        f"  Chofer:             {Chofer.objects.count()}\n"
        f"  Pyme:               {Pyme.objects.count()}\n"
        f"  CentroDistribucion: {CentroDistribucion.objects.count()}\n"
        f"  Producto:           {Producto.objects.count()}\n"
        f"  Orden:              {Orden.objects.count()}\n"
        f"  OrdenProducto:      {OrdenProducto.objects.count()}\n"
        f"  Recepcion:          {Recepcion.objects.count()}\n"
        f"  Distribucion:       {Distribucion.objects.count()}\n"
        "  (Bloque, BloqueOrden, EventOffset: no se generan)\n"
    )
