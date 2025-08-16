// src/app/features/read-api.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { of, Observable, firstValueFrom } from 'rxjs';
import { provideZonelessChangeDetection } from '@angular/core'; // 👈 ADD

import { ReadApi } from './read-api.service';
import { HttpService } from '../core/http/http.service';
import {
  Page, Orden, BloqueList, BloqueDetail, Recepcion, Distribucion,
} from '../shared/types/read-model';

// ---------- helpers ----------
const makePage = <U>(items: U[]): Page<U> => ({
  count: items.length, next: null, previous: null, results: items,
});

const makeOrden = (p: Partial<Orden> = {}): Orden => ({
  id: 'o-1',
  pyme: { id: 'p-1', nombre: 'Pyme 1' },
  origen_cd: { id: 'cd-1', nombre: 'CD Origen' },
  destino_cd: { id: 'cd-2', nombre: 'CD Destino' },
  fecha_despacho: '2025-08-10T00:00:00.000Z',
  estado_preparacion: 'PEN',
  estado_preparacion_label: 'Pendiente',
  peso_total: 10,
  volumen_total: 1,
  chofer: null,
  lineas: [],
  ...p,
});

const makeBloqueList = (p: Partial<BloqueList> = {}): BloqueList => ({
  id: 'b-1',
  fecha: '2025-08-10T00:00:00.000Z',
  chofer: null,
  chofer_nombre: 'Ana',
  total_ordenes: 3,
  estado_completitud: 'COM',
  estado_completitud_label: 'Completo',
  ...p,
});

const makeBloqueDetail = (p: Partial<BloqueDetail> = {}): BloqueDetail => ({
  ...makeBloqueList(),
  ordenes: [makeOrden()],
  ...p,
});

const makeRecepcion = (p: Partial<Recepcion> = {}): Recepcion => ({
  orden_id: 'o-1',
  cd: { id: 'cd-1', nombre: 'CD 1' },
  fecha_recepcion: '2025-08-11T00:00:00.000Z',
  usuario_receptor: 'user@test',
  incidencias: false,
  ...p,
});

const makeDistribucion = (p: Partial<Distribucion> = {}): Distribucion => ({
  orden_id: 'o-1',
  estado: 'PEN',
  estado_label: 'Pendiente',
  fecha_entrega: null,
  chofer_id: null,
  ...p,
});

// ---------- payloads simulados ----------
const RESP_DESP: Page<Orden>        = makePage([makeOrden()]);
const RESP_PREP: Page<Orden>        = makePage([makeOrden({ estado_preparacion: 'COM', estado_preparacion_label: 'Completa' })]);
const RESP_EXPE: Page<Orden>        = makePage([makeOrden()]);
const RESP_RECEP: Page<Recepcion>   = makePage([makeRecepcion()]);
const RESP_CONS: Page<BloqueList>   = makePage([makeBloqueList()]);
const RESP_BDET: BloqueDetail       = makeBloqueDetail();
const RESP_DIST: Page<Distribucion> = makePage([makeDistribucion()]);

describe('ReadApi (zoneless)', () => {
  let service: ReadApi;
  let http: jasmine.SpyObj<HttpService>;

  beforeEach(() => {
    http = jasmine.createSpyObj<HttpService>('HttpService', ['get']);

    (http.get as unknown as jasmine.Spy).and.callFake(
      <T>(path: string, _q?: Record<string, any>): Observable<T> => {
        switch (true) {
          case path === '/despacho/ordenes':               return of(RESP_DESP  as unknown as T);
          case path === '/preparacion/ordenes':            return of(RESP_PREP  as unknown as T);
          case path === '/expedicion/ordenes':             return of(RESP_EXPE  as unknown as T);
          case path === '/recepcion/ordenes':              return of(RESP_RECEP as unknown as T);
          case path === '/consolidacion/bloques':          return of(RESP_CONS  as unknown as T);
          case path.startsWith('/consolidacion/bloques/'): return of(RESP_BDET  as unknown as T);
          case path === '/distribucion/ordenes':           return of(RESP_DIST  as unknown as T);
          default: throw new Error('Path no simulado: ' + path);
        }
      }
    );

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),     // 👈 ADD para evitar NG0908
        ReadApi,
        { provide: HttpService, useValue: http },
      ],
    });

    service = TestBed.inject(ReadApi);
  });

  // ---------- paths + params ----------
  it('despacho: path y params correctos', async () => {
    const q = { cd: 'cd-1', pyme: 'p-1', page: 1 };
    const res = await firstValueFrom(service.despacho(q));
    expect(res.count).toBe(1);
    expect(http.get).toHaveBeenCalledWith('/despacho/ordenes', jasmine.objectContaining(q));
  });

  it('preparacion: estado y rango de fechas', async () => {
    const q = { estado: 'PEN' as const, desde: '2025-08-01', hasta: '2025-08-31', page: 2 };
    await firstValueFrom(service.preparacion(q));
    expect(http.get).toHaveBeenCalledWith('/preparacion/ordenes', jasmine.objectContaining(q));
  });

  it('expedicion: chofer_id/fecha', async () => {
    const q = { chofer_id: 'ch-1', fecha: '2025-08-12', page: 1 };
    await firstValueFrom(service.expedicion(q));
    expect(http.get).toHaveBeenCalledWith('/expedicion/ordenes', jasmine.objectContaining(q));
  });

  it('recepcion: cd/incidencias', async () => {
    const q = { cd: 'cd-2', incidencias: true, page: 3 };
    await firstValueFrom(service.recepcion(q));
    expect(http.get).toHaveBeenCalledWith('/recepcion/ordenes', jasmine.objectContaining(q));
  });

  it('consolidacion: fecha/chofer_nombre/estado', async () => {
    const q = { fecha: '2025-08-10', chofer_nombre: 'Ana', estado: 'COM' as const, page: 1 };
    await firstValueFrom(service.consolidacion(q));
    expect(http.get).toHaveBeenCalledWith('/consolidacion/bloques', jasmine.objectContaining(q));
  });

  it('bloqueDetalle: path por id', async () => {
    const id = 'b-1';
    await firstValueFrom(service.bloqueDetalle(id));
    expect(http.get).toHaveBeenCalledWith(`/consolidacion/bloques/${id}`, undefined);
  });

  it('distribucion: estado/page', async () => {
    const q = { estado: 'PEN' as const, page: 1 };
    await firstValueFrom(service.distribucion(q));
    expect(http.get).toHaveBeenCalledWith('/distribucion/ordenes', jasmine.objectContaining(q));
  });

  // ---------- caché ----------
  it('cachea path+query: mismas params => una llamada', async () => {
    http.get.calls.reset();
    const q = { cd: 'cd-1', pyme: 'p-1', page: 1 };
    const [a, b] = await Promise.all([
      firstValueFrom(service.despacho(q)),
      firstValueFrom(service.despacho(q)),
    ]);
    expect(a.count).toBe(1);
    expect(b.count).toBe(1);
    expect(http.get.calls.count()).toBe(1);
  });

  it('params distintos => nueva llamada', async () => {
    http.get.calls.reset();
    await firstValueFrom(service.despacho({ cd: 'cd-1', pyme: 'p-1', page: 1 }));
    await firstValueFrom(service.despacho({ cd: 'cd-1', pyme: 'p-1', page: 2 }));
    expect(http.get.calls.count()).toBe(2);
  });

  it('clearCache(prefix) invalida solo el prefijo', async () => {
    http.get.calls.reset();
    await firstValueFrom(service.despacho({ cd: 'cd-1', pyme: 'p-1', page: 1 }));
    await firstValueFrom(service.preparacion({ estado: 'PEN', page: 1 }));
    expect(http.get.calls.count()).toBe(2);

    service.clearCache('/despacho');

    await firstValueFrom(service.despacho({ cd: 'cd-1', pyme: 'p-1', page: 1 })); // re-hace
    await firstValueFrom(service.preparacion({ estado: 'PEN', page: 1 }));        // caché
    expect(http.get.calls.count()).toBe(3);
  });

  it('clearCache() sin prefijo limpia todo', async () => {
    http.get.calls.reset();
    await firstValueFrom(service.despacho({ cd: 'cd-1', pyme: 'p-1', page: 1 }));
    await firstValueFrom(service.preparacion({ estado: 'PEN', page: 1 }));
    expect(http.get.calls.count()).toBe(2);

    service.clearCache();

    await firstValueFrom(service.despacho({ cd: 'cd-1', pyme: 'p-1', page: 1 }));
    await firstValueFrom(service.preparacion({ estado: 'PEN', page: 1 }));
    expect(http.get.calls.count()).toBe(4);
  });
});
