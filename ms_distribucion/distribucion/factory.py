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
    Orden, OrdenProducto, Recepcion, Distribucion, Bolsa,
    EstadoPreparacion, EstadoDistribucion, TipoCentro
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

def _sample_dt(past_days=30, future_days=0) -> timezone.datetime:
    now = timezone.now()
    d = random.randint(-past_days, future_days)
    s = random.randint(0, 60 * 60 * 20)
    return now + timedelta(days=d, seconds=s)

def _split_dec(total: Decimal, n: int, q: str) -> list[Decimal]:
    """Parte un Decimal en n porciones que suman 'total'."""
    qd = Decimal(q)
    if n <= 0:
        return []
    if total <= 0:
        return [Decimal("0").quantize(qd) for _ in range(n)]
    ws = [random.random() for _ in range(n)]
    s = sum(ws) or 1.0
    parts = []
    acc = Decimal("0")
    for i, w in enumerate(ws):
        if i < n - 1:
            part = (total * Decimal(str(w / s))).quantize(qd)
            parts.append(part)
            acc += part
        else:
            parts.append((total - acc).quantize(qd))
    return parts

# ---------- seeding ----------
@transaction.atomic
def run(verbose: bool = True):
    # ---- Chofer ----
    ch_count = Chofer.objects.count()
    if verbose: print(f"[seed] Chofer: {ch_count} existentes")
    if ch_count < TARGET:
        Chofer.objects.bulk_create([Chofer(nombre=fake.name()) for _ in range(TARGET - ch_count)])
    choferes = list(Chofer.objects.all())

    # ---- Pyme ----
    py_count = Pyme.objects.count()
    if verbose: print(f"[seed] Pyme: {py_count} existentes")
    if py_count < TARGET:
        Pyme.objects.bulk_create([Pyme(id=_rid("py_"), nombre=fake.company()) for _ in range(TARGET - py_count)], ignore_conflicts=True)
    pymes = list(Pyme.objects.all())

    # ---- CentroDistribucion (CAP por PyME + CDs generales) ----
    cd_count = CentroDistribucion.objects.count()
    if verbose: print(f"[seed] CentroDistribucion: {cd_count} existentes")

    caps_nuevos = []
    for py in pymes:
        existe_cap = CentroDistribucion.objects.filter(tipo=TipoCentro.CAP, pyme_asociada=py).exists()
        if not existe_cap:
            caps_nuevos.append(CentroDistribucion(
                id=_rid("cap_"),
                nombre=f"{py.nombre} CAP",
                tipo=TipoCentro.CAP,
                pyme_asociada=py
            ))
    if caps_nuevos:
        CentroDistribucion.objects.bulk_create(caps_nuevos, ignore_conflicts=True)

    cds_generales_exist = CentroDistribucion.objects.filter(tipo=TipoCentro.CD).count()
    faltan_cds = max(0, TARGET - cds_generales_exist)
    if faltan_cds:
        CentroDistribucion.objects.bulk_create([
            CentroDistribucion(id=_rid("cd_"), nombre=f"{fake.city()} CD", tipo=TipoCentro.CD, pyme_asociada=None)
            for _ in range(faltan_cds)
        ], ignore_conflicts=True)

    caps_por_pyme = {
        py.id: list(CentroDistribucion.objects.filter(tipo=TipoCentro.CAP, pyme_asociada=py))
        for py in pymes
    }
    cds_generales = list(CentroDistribucion.objects.filter(tipo=TipoCentro.CD))
    if not cds_generales:
        cds_generales = list(CentroDistribucion.objects.all()) or [
            CentroDistribucion.objects.create(id=_rid("cd_"), nombre=f"{fake.city()} CD", tipo=TipoCentro.CD)
        ]

    # ---- Producto ----
    pr_count = Producto.objects.count()
    if verbose: print(f"[seed] Producto: {pr_count} existentes")
    if pr_count < TARGET:
        nuevos = []
        for _ in range(TARGET - pr_count):
            sku = f"SKU-{uuid.uuid4().hex[:10].upper()}"
            nuevos.append(Producto(sku=sku, nombre=fake.word().capitalize()))
        Producto.objects.bulk_create(nuevos, ignore_conflicts=True)
    productos = list(Producto.objects.all())

    # ---- Orden (PYME -> CAP origen, CD destino) ----
    ord_count = Orden.objects.count()
    if verbose: print(f"[seed] Orden: {ord_count} existentes")
    nuevos_ids: list[str] = []
    if ord_count < TARGET:
        nuevos = []
        for _ in range(TARGET - ord_count):
            py = random.choice(pymes)
            caps_py = caps_por_pyme.get(py.id) or list(CentroDistribucion.objects.filter(tipo=TipoCentro.CAP))
            if not caps_py:
                caps_py = cds_generales
            o_cd = random.choice(caps_py)
            d_cd = random.choice(cds_generales)
            if d_cd.id == o_cd.id and len(cds_generales) > 1:
                d_cd = random.choice([c for c in cds_generales if c.id != o_cd.id])

            fecha = _sample_dt(30, 0)
            oid = _rid("ord_", 18)
            nuevos_ids.append(oid)
            nuevos.append(Orden(
                id=oid,
                pyme=py,
                origen_cd=o_cd,
                destino_cd=d_cd,
                fecha_despacho=fecha,
                estado_preparacion=random.choices(
                    [EstadoPreparacion.PENDIENTE, EstadoPreparacion.COMPLETA],
                    weights=[0.7, 0.3],
                    k=1
                )[0],
                peso_total=Decimal("0.000"),
                volumen_total=Decimal("0.000000"),
                chofer=random.choice([None] * 2 + [random.choice(choferes)]),
            ))
        if nuevos:
            Orden.objects.bulk_create(nuevos)

    ordenes = list(Orden.objects.select_related("origen_cd", "destino_cd", "pyme"))

    # ---- OrdenProducto (para órdenes nuevas) + recalcular totales ----
    if nuevos_ids and productos:
        nuevos_op = []
        for oid in nuevos_ids:
            n_lineas = random.randint(1, 4)
            usados_prod = set()
            for _ in range(n_lineas):
                for _try in range(6):
                    p = random.choice(productos)
                    if p.id not in usados_prod:
                        usados_prod.add(p.id)
                        break
                qty = random.randint(1, 12)
                peso = _rand_dec(0.1, 10, "0.001")
                vol  = _rand_dec(0.001, 0.2, "0.000001")
                nuevos_op.append(OrdenProducto(
                    orden_id=oid, producto=p, qty=qty, peso=peso, volumen=vol,
                ))
        if nuevos_op:
            OrdenProducto.objects.bulk_create(nuevos_op, ignore_conflicts=True)

        from django.db.models import Sum
        agg = (OrdenProducto.objects
               .filter(orden_id__in=nuevos_ids)
               .values('orden_id')
               .annotate(peso=Sum('peso'), volumen=Sum('volumen')))
        mapa = {a['orden_id']: a for a in agg}
        nuevas_ordenes = list(Orden.objects.filter(id__in=nuevos_ids))
        for o in nuevas_ordenes:
            a = mapa.get(o.id)
            if a:
                o.peso_total = a['peso'] or Decimal("0.000")
                o.volumen_total = a['volumen'] or Decimal("0.000000")
        if nuevas_ordenes:
            Orden.objects.bulk_update(nuevas_ordenes, ['peso_total', 'volumen_total'])

    # ---- BOLSAS (solo órdenes con preparación COMPLETA, sin bolsas previas) ----
    from django.db.models import Count
    if verbose: print(f"[seed] Bolsas: {Bolsa.objects.count()} existentes")
    candidatas = (Orden.objects
                  .filter(estado_preparacion=EstadoPreparacion.COMPLETA)
                  .annotate(bc=Count('bolsas'))
                  .filter(bc=0))
    nuevas_bolsas = []
    for o in candidatas:
        n = random.randint(1, 3)
        pesos = _split_dec(o.peso_total or Decimal("0.000"), n, "0.001")
        vols  = _split_dec(o.volumen_total or Decimal("0.000000"), n, "0.000001")
        base_dt = o.fecha_despacho + timedelta(hours=random.randint(1, 24))
        for i in range(n):
            nuevas_bolsas.append(Bolsa(
                codigo=f"BAG-{uuid.uuid4().hex[:10].upper()}",
                orden=o,
                peso=pesos[i],
                volumen=vols[i],
                preparada=True,
                fecha_preparacion=base_dt + timedelta(minutes=random.randint(0, 180)),
                usuario_preparador=fake.user_name(),
            ))
    if nuevas_bolsas:
        Bolsa.objects.bulk_create(nuevas_bolsas, ignore_conflicts=True)

    # ---- Recepcion (en CD destino) ----
    rc_count = Recepcion.objects.count()
    if verbose: print(f"[seed] Recepcion: {rc_count} existentes")
    if rc_count < TARGET:
        existentes = set(Recepcion.objects.values_list("orden_id", flat=True))
        candidatos = [o for o in ordenes if o.id not in existentes]
        random.shuffle(candidatos)
        nuevos = []
        for o in candidatos[:TARGET - rc_count]:
            fecha_rc = o.fecha_despacho + timedelta(hours=random.randint(2, 48))
            nuevos.append(Recepcion(
                orden=o,
                cd=o.destino_cd,
                fecha_recepcion=fecha_rc,
                usuario_receptor=fake.user_name(),
                incidencias=random.choice([True] + [False] * 3),
            ))
        if nuevos:
            Recepcion.objects.bulk_create(nuevos, ignore_conflicts=True)

    # ---- Distribucion ----
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
        f"  Bolsa:              {Bolsa.objects.count()}\n"
        f"  Recepcion:          {Recepcion.objects.count()}\n"
        f"  Distribucion:       {Distribucion.objects.count()}\n"
        "  (Bloque/BloqueOrden no se generan en este seeding)\n"
    )
