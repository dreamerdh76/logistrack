// src/app/features/preparacion/preparacion.page.spec.ts
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, NavigationExtras } from '@angular/router';
import { BehaviorSubject, firstValueFrom, of, take, toArray, throwError } from 'rxjs';
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

  it('vm$ emite loading y luego datos; la API recibe page, page_size y ordering (sin estado vacío)', async () => {
    type VM = {
      q: any; page: number; ordering: string;
      data: Orden[]; count: number; loading: boolean; error: any;
      sortField: string | null; sortOrder: 1 | -1 | 0;
    };

    const emissions = await firstValueFrom(component.vm$.pipe(take(2), toArray()));
    const loading = emissions[0] as VM;
    const ready   = emissions[1] as VM;

    expect(api.preparacion).toHaveBeenCalled();
    const args = api.preparacion.calls.mostRecent().args[0] as any;
    expect(args.page).toBe(1);
    expect(args.page_size).toBe(component.ROWS);
    expect(args.ordering).toBe('-fecha_despacho');
    expect('estado' in args).toBeFalse(); // no enviar filtro vacío

    expect(loading.loading).toBeTrue();
    expect(ready.loading).toBeFalse();
    expect(ready.count).toBe(2);
    expect(ready.page).toBe(1);
    expect(ready.ordering).toBe('-fecha_despacho');
    expect(ready.sortField).toBe('fecha_despacho');
    expect(ready.sortOrder).toBe(-1);
  });

  it('cuando la API falla, vm$ expone error y data vacía', async () => {
    api.preparacion.and.returnValue(throwError(() => new Error('falló')));

    type VM = { loading: boolean; error: any; data: Orden[]; count: number };
    const emissions = await firstValueFrom(component.vm$.pipe(take(2), toArray()));
    const loading = emissions[0] as VM;
    const errorVm = emissions[1] as VM;

    expect(loading.loading).toBeTrue();
    expect(errorVm.loading).toBeFalse();
    expect(errorVm.error).toBeTruthy();
    expect(errorVm.data.length).toBe(0);
  });

  it('onFilters aplica estado (trim) y resetea page=1 preservando ordering (sin merge)', () => {
    component.onFilters({ estado: '  COM  ' });

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining<NavigationExtras>({
        relativeTo: routeStub,
        queryParams: { estado: 'COM', page: 1, ordering: '-fecha_despacho' },
      })
    );
  });

  it('onCleared limpia filtros y deja page=1 + ordering (sin merge)', () => {
    component.onCleared();

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining<NavigationExtras>({
        relativeTo: routeStub,
        queryParams: { page: 1, ordering: '-fecha_despacho' },
      })
    );
  });

  it('onPage navega a page (index + 1) manteniendo filtros actuales y ordering', () => {
    const q = { estado: 'PEN' as const };
    component.onPage({ pageIndex: 4, pageSize: 5, length: 25 } as any, q); // → page 5

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining<NavigationExtras>({
        relativeTo: routeStub,
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
    const com: Orden = { ...pen, id: 'o-2', estado_preparacion: 'COM', estado_preparacion_label: 'Completa' };

    const col = component.columns.find(c => c.header === 'Estado')!;
    const classOf = (v: any, r: Orden) => (typeof v === 'function' ? v(r) : (v ?? ''));

    expect(col.template!(pen)).toBe('Pendiente');
    expect(col.template!(com)).toBe('Completa');
    expect(classOf(col.bodyClass, pen)).toContain('text-red-600');
    expect(classOf(col.bodyClass, com)).toContain('text-green-600');
  });
});
