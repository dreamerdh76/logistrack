// src/app/features/preparacion/preparacion.page.spec.ts
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  Router,
  convertToParamMap,
  NavigationExtras,
} from '@angular/router';
import {
  BehaviorSubject,
  firstValueFrom,
  of,
  take,
  toArray,
  throwError,
} from 'rxjs';
import { provideZonelessChangeDetection } from '@angular/core';

import { PreparacionPage } from './preparacion.page';
import { ReadApi } from '../read-api.service';
import { Orden, Page } from '../../shared/types/read-model';

// ---- Mock API ----
class MockReadApi {
  preparacion = jasmine.createSpy('preparacion').and.returnValue(
    of<Page<Orden>>({
      count: 2,
      next: null,
      previous: null,
      results: [
        {
          id: 'o-1',
          pyme: { id: 'p-1', nombre: 'Pyme 1' },
          origen_cd: { id: 'cd-1', nombre: 'CD Origen' },
          destino_cd: { id: 'cd-2', nombre: 'CD Destino' },
          fecha_despacho: '2025-08-12T12:00:00.000Z',
          estado_preparacion: 'PEN',
          estado_preparacion_label: 'Pendiente',
          peso_total: 10,
          volumen_total: 1,
          chofer: null,
          lineas: [],
        },
        {
          id: 'o-2',
          pyme: { id: 'p-2', nombre: 'Pyme 2' },
          origen_cd: { id: 'cd-1', nombre: 'CD Origen' },
          destino_cd: { id: 'cd-3', nombre: 'CD Destino 3' },
          fecha_despacho: '2025-08-13T09:30:00.000Z',
          estado_preparacion: 'COM',
          estado_preparacion_label: 'Completa',
          peso_total: 5,
          volumen_total: 0.5,
          chofer: null,
          lineas: [],
        },
      ],
    })
  );
}

describe('PreparacionPage (standalone, zoneless)', () => {
  let component: PreparacionPage;
  let router: jasmine.SpyObj<Router>;
  let api: MockReadApi;
  let q$: BehaviorSubject<any>;
  let routeStub: any;

  beforeEach(async () => {
    q$ = new BehaviorSubject(
      convertToParamMap({
        estado: '',
        page: '1',
        ordering: '-fecha_despacho',
      })
    );
    routeStub = {
      queryParamMap: q$.asObservable(),
      snapshot: { queryParamMap: q$.value },
    };

    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [PreparacionPage],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ActivatedRoute, useValue: routeStub },
        { provide: Router, useValue: router },
        { provide: ReadApi, useClass: MockReadApi },
      ],
    }).compileComponents();

    api = TestBed.inject(ReadApi) as unknown as MockReadApi;
    component = TestBed.createComponent(PreparacionPage).componentInstance;
  });

  it('debe crearse', () => {
    expect(component).toBeTruthy();
  });

  it('vm$ emite loading y luego datos (mantiene ordering)', async () => {
    type VM = { q: any; data: Orden[]; count: number; loading: boolean; error: any };

    const emissions = await firstValueFrom(
      component.vm$.pipe(take(2), toArray())
    );
    const [loading, ready] = emissions as [VM, VM];

    expect(loading.loading).toBeTrue();
    expect(ready.loading).toBeFalse();
    expect(ready.count).toBe(2);
    expect(ready.q.ordering).toBe('-fecha_despacho');
  });

  it('cuando la API falla, vm$ expone error y data vacía', async () => {
    // 1) forzamos error en la API
    api.preparacion.and.returnValue(throwError(() => new Error('falló')));
    api.preparacion.calls.reset();

    // 2) recreamos el componente para que cualquier suscripción previa no afecte
    component = TestBed.createComponent(PreparacionPage).componentInstance;

    // 3) el tipo VM debe incluir count (lo emite vm$)
    type VM = { loading: boolean; error: any; data: Orden[]; q: any; count: number };

    // 4) tomamos las dos emisiones: loading y luego error
    const emissions = await firstValueFrom(component.vm$.pipe(take(2), toArray()));
    const [loading, errorVm] = emissions as [VM, VM];

    expect(api.preparacion).toHaveBeenCalledTimes(1);
    expect(loading.loading).toBeTrue();

    expect(errorVm.loading).toBeFalse();
    expect(errorVm.error).toBeTruthy();   // <-- ahora no será null
    expect(errorVm.data.length).toBe(0);  // <-- ahora será 0
  });



  it('onFilters aplica estado y resetea page=1', () => {
    component.onFilters({ estado: 'COM' });

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining<NavigationExtras>({
        relativeTo: routeStub,
        queryParamsHandling: 'merge',
        queryParams: { estado: 'COM', page: 1 },
      })
    );
  });

  it('onCleared limpia estado y page=1', () => {
    component.onCleared();

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining<NavigationExtras>({
        relativeTo: routeStub,
        queryParamsHandling: 'merge',
        queryParams: { estado: null, page: 1 },
      })
    );
  });

  it('onPage navega a page (index + 1) manteniendo query', () => {
    const q = { estado: 'PEN', page: 2, ordering: '-fecha_despacho' };
    component.onPage({ pageIndex: 4, pageSize: 5, length: 25 } as any, q); // → page 5

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining<NavigationExtras>({
        relativeTo: routeStub,
        queryParamsHandling: 'merge',
        queryParams: { estado: 'PEN', page: 5, ordering: '-fecha_despacho' },
      })
    );
  });

  it('firstOf calcula índice inicial con ROWS=5', () => {
    expect(component.firstOf(1)).toBe(0);
    expect(component.firstOf(2)).toBe(5);
    expect(component.firstOf(5)).toBe(20);
    expect(component.firstOf(undefined as any)).toBe(0);
  });

  it('trackRow devuelve el id de la orden', () => {
    const o: Orden = {
      id: 'o-x',
      pyme: { id: 'p-1', nombre: 'Pyme 1' },
      origen_cd: { id: 'cd-1', nombre: 'CD Origen' },
      destino_cd: { id: 'cd-2', nombre: 'CD Destino' },
      fecha_despacho: '2025-08-12T12:00:00.000Z',
      estado_preparacion: 'PEN',
      estado_preparacion_label: 'Pendiente',
      peso_total: 1,
      volumen_total: 1,
      chofer: null,
      lineas: [],
    };
    expect(component.trackRow(0, o)).toBe('o-x');
  });

  it('columnas: template y clases por estado', () => {
    const pen: Orden = {
      id: 'o-1',
      pyme: { id: 'p-1', nombre: 'Pyme 1' },
      origen_cd: { id: 'cd-1', nombre: 'CD Origen' },
      destino_cd: { id: 'cd-2', nombre: 'CD Destino' },
      fecha_despacho: '2025-08-12T12:00:00.000Z',
      estado_preparacion: 'PEN',
      estado_preparacion_label: 'Pendiente',
      peso_total: 1,
      volumen_total: 1,
      chofer: null,
      lineas: [],
    };
    const com: Orden = {
      ...pen,
      id: 'o-2',
      estado_preparacion: 'COM',
      estado_preparacion_label: 'Completa',
    };

    const col = component.columns.find((c) => c.header === 'Estado')!;
    const evalClass = (v: any, r: Orden) =>
      typeof v === 'function' ? v(r) : v ?? '';

    expect(col.template!(pen)).toBe('Pendiente');
    expect(col.template!(com)).toBe('Completa');
    expect(evalClass(col.bodyClass, pen)).toContain('text-red-600');
    expect(evalClass(col.bodyClass, com)).toContain('text-green-600');
  });
});
