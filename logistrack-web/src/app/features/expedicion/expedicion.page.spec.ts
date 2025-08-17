// src/app/features/expedicion/expedicion.page.spec.ts
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, NavigationExtras } from '@angular/router';
import { BehaviorSubject, firstValueFrom, of, take, toArray, throwError } from 'rxjs';
import { provideZonelessChangeDetection } from '@angular/core';

import { ExpedicionPage } from './expedicion.page';
import { ReadApi } from '../read-api.service';
import { Orden, Page } from '../../shared/types/read-model';

/* ---------- Mock API ---------- */
class MockReadApi {
  expedicion = jasmine.createSpy('expedicion').and.returnValue(
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
          chofer: { id: 'c-1', nombre: 'Luis' },
          lineas: [],
        },
        {
          id: 'o-2',
          pyme: { id: 'p-2', nombre: 'Pyme 2' },
          origen_cd: { id: 'cd-1', nombre: 'CD Origen' },
          destino_cd: { id: 'cd-3', nombre: 'CD Destino 3' },
          fecha_despacho: '2025-08-13T09:30:00.000Z',
          estado_preparacion: 'PEN',
          estado_preparacion_label: 'Pendiente',
          peso_total: 5,
          volumen_total: 0.5,
          chofer: null,
          lineas: [],
        },
      ],
    })
  );
}

describe('ExpedicionPage (standalone, zoneless)', () => {
  let component: ExpedicionPage;
  let router: jasmine.SpyObj<Router>;
  let api: MockReadApi;
  let q$: BehaviorSubject<any>;
  let routeStub: any;

  beforeEach(async () => {
    // Query inicial: filtros vacíos + ordering por defecto
    q$ = new BehaviorSubject(
      convertToParamMap({
        chofer: '',
        fecha: '',
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
      imports: [ExpedicionPage],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ActivatedRoute, useValue: routeStub },
        { provide: Router, useValue: router },
        { provide: ReadApi, useClass: MockReadApi },
      ],
    }).compileComponents();

    api = TestBed.inject(ReadApi) as unknown as MockReadApi;
    component = TestBed.createComponent(ExpedicionPage).componentInstance;
  });

  it('debe crearse', () => {
    expect(component).toBeTruthy();
  });

  it('vm$ emite loading y luego datos; la API recibe page, page_size y ordering (sin filtros vacíos)', async () => {
    type VM = {
      q: any; page: number; ordering: string; data: Orden[]; count: number; loading: boolean; error: any;
    };

    const emissions = await firstValueFrom(component.vm$.pipe(take(2), toArray()));
    expect(emissions.length).toBe(2);

    const loading = emissions[0] as VM;
    const ready   = emissions[1] as VM;

    expect(api.expedicion).toHaveBeenCalled();
    const args = api.expedicion.calls.mostRecent().args[0] as any;

    expect(args.page).toBe(1);
    expect(args.page_size).toBe(component.ROWS);
    expect(args.ordering).toBe('-fecha_despacho');
    // No deben viajar filtros cuando están vacíos
    expect('chofer' in args).toBeFalse();
    expect('fecha' in args).toBeFalse();

    expect(loading.loading).toBeTrue();
    expect(ready.loading).toBeFalse();
    expect(ready.count).toBe(2);
    expect(ready.page).toBe(1);
    expect(ready.ordering).toBe('-fecha_despacho');
  });

  it('cuando la API falla, vm$ expone error y data vacía', async () => {
    api.expedicion.and.returnValue(throwError(() => new Error('falló')));

    type VM = { loading: boolean; error: any; data: Orden[]; q: any };
    const emissions = await firstValueFrom(component.vm$.pipe(take(2), toArray()));
    expect(emissions.length).toBe(2);

    const loading = emissions[0] as VM;
    const errorVm = emissions[1] as VM;

    expect(loading.loading).toBeTrue();
    expect(errorVm.loading).toBeFalse();
    expect(errorVm.error).toBeTruthy();
    expect(errorVm.data.length).toBe(0);
  });

  it('onFilters aplica filtros (trim) y resetea page=1 preservando ordering (sin merge)', () => {
    component.onFilters({ chofer: '  c-1  ', fecha: ' 2025-08-12 ' });

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining<NavigationExtras>({
        relativeTo: routeStub,
        queryParams: { chofer: 'c-1', fecha: '2025-08-12', page: 1, ordering: '-fecha_despacho' },
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

  it('onPage navega a page (index + 1) manteniendo filtros y ordering', () => {
    const q = { chofer: 'c-1', fecha: '2025-08-12' };
    component.onPage({ pageIndex: 3, pageSize: 5, length: 20 } as any, q); // → page 4

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining<NavigationExtras>({
        relativeTo: routeStub,
        queryParams: { chofer: 'c-1', fecha: '2025-08-12', page: 4, ordering: '-fecha_despacho' },
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
      peso_total: 10,
      volumen_total: 1,
      chofer: null,
      lineas: [],
    };
    expect(component.trackRow(0, o)).toBe('o-x');
  });

  it('columnas: cell mapea correctamente chofer y fecha', () => {
    const row: Orden = {
      id: 'o-1',
      pyme: { id: 'p-1', nombre: 'Pyme 1' },
      origen_cd: { id: 'cd-1', nombre: 'CD Origen' },
      destino_cd: { id: 'cd-2', nombre: 'CD Destino' },
      fecha_despacho: '2025-08-12T12:00:00.000Z',
      estado_preparacion: 'PEN',
      estado_preparacion_label: 'Pendiente',
      peso_total: 10,
      volumen_total: 1,
      chofer: { id: 'c-1', nombre: 'Luis' },
      lineas: [],
    };

    const choferCol = component.columns.find(c => c.header === 'Chofer')!;
    const fechaCol  = component.columns.find(c => c.header === 'Fecha')!;
    const idCol     = component.columns.find(c => c.header === 'Orden')!;

    expect(idCol.cell!(row)).toBe('o-1');
    expect(choferCol.cell!(row)).toBe('Luis');
    expect(typeof fechaCol.cell!(row)).toBe('string');
  });
});
