// src/app/features/consolidacion/bloque-detalle.page.spec.ts
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject, firstValueFrom, of, take, toArray, throwError } from 'rxjs';
import { provideZonelessChangeDetection } from '@angular/core';

import { BloqueDetallePage } from './bloque-detalle.page';
import { ReadApi } from '../read-api.service';
import { BloqueDetail, BloqueList, Orden, Page } from '../../shared/types/read-model';

// ---------- helpers de datos ----------
const makeOrden = (p: Partial<Orden> = {}): Orden => ({
  id: 'o-1',
  pyme: { id: 'p-1', nombre: 'Pyme 1' },
  origen_cd: { id: 'cd-1', nombre: 'CD Origen' },
  destino_cd: { id: 'cd-2', nombre: 'CD Destino' },
  fecha_despacho: '2025-08-10T10:00:00.000Z',
  estado_preparacion: 'PEN',
  estado_preparacion_label: 'Pendiente',
  peso_total: 10,
  volumen_total: 1,
  chofer: null,
  lineas: [],
  ...p,
});

const makeDetail = (p: Partial<BloqueDetail> = {}): BloqueDetail => ({
  id: 'b-1',
  fecha: '2025-08-10T10:00:00.000Z',
  chofer: null,
  chofer_nombre: 'Ana',
  total_ordenes: 1,
  estado_completitud: 'COM',
  ordenes: [makeOrden()],
  ...p,
});

// Mock de ReadApi: responde con el id solicitado
class MockReadApi {
  bloqueDetalle = jasmine.createSpy('bloqueDetalle').and.callFake((id: string) =>
    of(makeDetail({ id, ordenes: [makeOrden({ id: 'o-' + id })] }))
  );
}
function assertPresent<T>(v: T | null | undefined): asserts v is T {
  expect(v).toBeTruthy(); // fuerza el estrechamiento
}


describe('BloqueDetallePage (standalone, zoneless)', () => {
  let component: BloqueDetallePage;
  let api: MockReadApi;
  let route$: BehaviorSubject<any>;
  let routeStub: any;

  beforeEach(async () => {
    route$ = new BehaviorSubject(convertToParamMap({ id: 'b-1' }));
    routeStub = { paramMap: route$.asObservable(), snapshot: { paramMap: route$.value } };

    await TestBed.configureTestingModule({
      imports: [BloqueDetallePage],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ActivatedRoute, useValue: routeStub },
        { provide: ReadApi, useClass: MockReadApi },
        { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigate']) },
      ],
    }).compileComponents();

    api = TestBed.inject(ReadApi) as unknown as MockReadApi;
    component = TestBed.createComponent(BloqueDetallePage).componentInstance;
  });

  it('debe crearse', () => {
    expect(component).toBeTruthy();
  });

  it('vm$ emite loading y luego el detalle del id de la ruta', async () => {
    type VM = { b: BloqueDetail | null; loading: boolean; error: any };

    const [loading, ready] = await firstValueFrom(
      component.vm$.pipe(take(2), toArray())
    ) as [VM, VM];

    expect(loading.loading).toBeTrue();
    expect(ready.loading).toBeFalse();

    // 1) estrechamos ready.b
    assertPresent(ready.b);
    expect(ready.b.id).toBe('b-1');

    // 2) garantizamos que hay órdenes y luego accedemos a [0]
    expect(ready.b.ordenes.length).toBeGreaterThan(0);
    const first = ready.b.ordenes[0]!;   // non-null después de la aserción anterior
    expect(first.id).toBe('o-b-1');
  });

  it('onRetry vuelve a consultar el mismo id', async () => {
    // primera suscripción (dispara 1ra llamada)
    await firstValueFrom(component.vm$.pipe(take(1)));
    expect(api.bloqueDetalle.calls.count()).toBe(1);

    // retry → nueva llamada
    component.onRetry();
    await firstValueFrom(component.vm$.pipe(take(1)));
    expect(api.bloqueDetalle.calls.count()).toBe(2);
  });

  it('cambiar el id en la ruta dispara nueva carga con ese id', async () => {
    await firstValueFrom(component.vm$.pipe(take(1)));
    expect(api.bloqueDetalle.calls.count()).toBe(1);

    route$.next(convertToParamMap({ id: 'b-2' }));
    await firstValueFrom(component.vm$.pipe(take(1)));

    expect(api.bloqueDetalle.calls.count()).toBe(2);
    expect(api.bloqueDetalle.calls.mostRecent().args[0]).toBe('b-2');
  });

  it('cuando la API falla, vm$ expone error y no b', async () => {
    type VM = { b: BloqueDetail | null; loading: boolean; error: any };

    api.bloqueDetalle.and.returnValue(throwError(() => new Error('falló')));

    const [loading, errorState] = await firstValueFrom(
      component.vm$.pipe(take(2), toArray())
    ) as [VM, VM];

    expect(loading.loading).toBeTrue();

    expect(errorState.loading).toBeFalse();
    expect(errorState.b).toBeNull();
    expect(errorState.error).toBeTruthy();

  });

  it('statusClass mapea correctamente', () => {
    expect(component.statusClass('COM')).toContain('bg-green');
    expect(component.statusClass('Completo')).toContain('bg-green');
    expect(component.statusClass('INC')).toContain('bg-red');
    expect(component.statusClass('Pendiente')).toContain('bg-amber');
    expect(component.statusClass('???')).toContain('bg-gray');
  });

  it('trackOrden y rowTrackBy devuelven el id', () => {
    const o = makeOrden({ id: 'o-x' });
    expect(component.trackOrden(0, o)).toBe('o-x');
    expect(component.rowTrackBy(0, o)).toBe('o-x');
  });
});
