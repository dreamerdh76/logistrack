// src/app/features/despacho/despacho.page.spec.ts
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, NavigationExtras } from '@angular/router';
import { BehaviorSubject, of, firstValueFrom, take, toArray } from 'rxjs';
import { provideZonelessChangeDetection } from '@angular/core';

import { DespachoPage } from './despacho.page';
import { ReadApi } from '../read-api.service';
import { Orden, Page } from '../../shared/types/read-model';

// ---- Mock API ----
class MockReadApi {
  despacho = jasmine.createSpy('despacho').and.returnValue(
    of<Page<Orden>>({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 'o-1',
          pyme: { id: 'p-1', nombre: 'Pyme 1' },
          origen_cd: { id: 'cd-1', nombre: 'CD Origen' },
          destino_cd: { id: 'cd-2', nombre: 'CD Destino' },
          fecha_despacho: '2025-08-10T08:00:00.000Z',
          estado_preparacion: 'PEN',
          estado_preparacion_label: 'Pendiente',
          peso_total: 10,
          volumen_total: 1,
          chofer: null,
          lineas: [],
        },
      ],
    })
  );
}

describe('DespachoPage (standalone, zoneless)', () => {
  let component: DespachoPage;
  let router: jasmine.SpyObj<Router>;
  let api: MockReadApi;
  let q$: BehaviorSubject<any>;
  let routeStub: any;

  beforeEach(async () => {
    q$ = new BehaviorSubject(
      convertToParamMap({ page: '1', cd: '', pyme: '' })
    );
    routeStub = {
      queryParamMap: q$.asObservable(),
      snapshot: { queryParamMap: q$.value },
    };

    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [DespachoPage],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ActivatedRoute, useValue: routeStub },
        { provide: Router, useValue: router },
        { provide: ReadApi, useClass: MockReadApi },
      ],
    }).compileComponents();

    api = TestBed.inject(ReadApi) as unknown as MockReadApi;
    component = TestBed.createComponent(DespachoPage).componentInstance;
  });

  it('debe crearse', () => {
    expect(component).toBeTruthy();
  });

  it('vm$ emite loading y luego datos (sin Zone/fakeAsync)', async () => {
    type VM = {
      q: { cd: string; pyme: string; page: number };
      data: Orden[]; count: number; loading: boolean; error: any;
    };

    const [loading, ready] = await firstValueFrom(
      component.vm$.pipe(take(2), toArray())
    ) as [VM, VM];

    expect(api.despacho).toHaveBeenCalledWith({ cd: undefined, pyme: undefined, page: 1 });
    expect(loading.loading).toBeTrue();
    expect(ready.loading).toBeFalse();
    expect(ready.count).toBe(1);
    expect(ready.data.length).toBe(1);
  });

  it('onFilters aplica cd/pyme y resetea page=1', () => {
    component.onFilters({ cd: 'CD1', pyme: 'P-ACME' });

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining<NavigationExtras>({
        relativeTo: routeStub,
        queryParamsHandling: 'merge',
        queryParams: { cd: 'CD1', pyme: 'P-ACME', page: 1 },
      })
    );
  });

  it('onCleared limpia filtros y page=1', () => {
    component.onCleared();

    // Nota: si este test falla porque el código usa `pyme_id`,
    // corrige `onCleared()` para usar `pyme: null`
    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining<NavigationExtras>({
        relativeTo: routeStub,
        queryParamsHandling: 'merge',
        queryParams: { cd: null, pyme: null, page: 1 },
      })
    );
  });

  it('onPage navega a page (index + 1) manteniendo query', () => {
    const q = { cd: 'CD2', pyme: 'P-1', page: 1 };
    component.onPage({ pageIndex: 3, pageSize: 5 }, q); // -> page 4

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining<NavigationExtras>({
        relativeTo: routeStub,
        queryParamsHandling: 'merge',
        queryParams: { cd: 'CD2', pyme: 'P-1', page: 4 },
      })
    );
  });

  it('firstOf calcula índice inicial con ROWS=5', () => {
    expect(component.firstOf(1)).toBe(0);
    expect(component.firstOf(2)).toBe(5);
    expect(component.firstOf(5)).toBe(20);
    expect(component.firstOf(undefined as any)).toBe(0);
  });

  it('columnas: cell mapea correctamente los minis y la fecha', () => {
    const row: Orden = {
      id: 'o-1',
      pyme: { id: 'p-1', nombre: 'Pyme 1' },
      origen_cd: { id: 'cd-1', nombre: 'CD Origen' },
      destino_cd: { id: 'cd-2', nombre: 'CD Destino' },
      fecha_despacho: '2025-08-10T08:00:00.000Z',
      estado_preparacion: 'PEN',
      estado_preparacion_label: 'Pendiente',
      peso_total: 10,
      volumen_total: 1,
      chofer: null,
      lineas: [],
    };

    const cells = Object.fromEntries(
      component.columns.map(c => [c.header, c.cell!(row)])
    );

    expect(cells['Orden']).toBe('o-1');
    expect(cells['PyME']).toBe('Pyme 1');
    expect(cells['Origen']).toBe('CD Origen');
    expect(cells['Destino']).toBe('CD Destino');
    expect(typeof cells['Fecha']).toBe('string');
  });
});
