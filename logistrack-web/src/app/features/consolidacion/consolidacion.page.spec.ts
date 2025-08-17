// src/app/features/consolidacion/consolidacion.page.spec.ts
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, NavigationExtras } from '@angular/router';
import { BehaviorSubject, of, firstValueFrom, take, toArray } from 'rxjs';
import { provideZonelessChangeDetection } from '@angular/core';

import { ConsolidacionPage } from './consolidacion.page';
import { ReadApi } from '../read-api.service';
import { BloqueList, Page } from '../../shared/types/read-model';

/* ------------ Mock API ------------ */
class MockReadApi {
  consolidacion = jasmine.createSpy('consolidacion').and.returnValue(
    of<Page<BloqueList>>({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 'b1',
          fecha: '2025-08-10T10:00:00.000Z',
          chofer: null,
          chofer_nombre: 'Ana',
          total_ordenes: 3,
          estado_completitud: 'COM',
          estado_completitud_label: 'Completo',
        },
      ],
    })
  );
}

describe('ConsolidacionPage (standalone, zoneless)', () => {
  let component: ConsolidacionPage;
  let router: jasmine.SpyObj<Router>;
  let api: MockReadApi;
  let q$: BehaviorSubject<any>;
  let routeStub: any;

  beforeEach(async () => {
    // filtros vacíos -> no deben viajar a la API
    q$ = new BehaviorSubject(
      convertToParamMap({ page: '1', fecha: '', chofer_nombre: '', estado: '' })
    );
    routeStub = {
      queryParamMap: q$.asObservable(),
      snapshot: { queryParamMap: q$.value },
    };

    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [ConsolidacionPage],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ActivatedRoute, useValue: routeStub },
        { provide: Router, useValue: router },
        { provide: ReadApi, useClass: MockReadApi },
      ],
    }).compileComponents();

    api = TestBed.inject(ReadApi) as unknown as MockReadApi;
    component = TestBed.createComponent(ConsolidacionPage).componentInstance;
  });

  it('debe crearse', () => {
    expect(component).toBeTruthy();
  });

  it('vm$ emite loading y luego datos; la API recibe page y page_size (sin filtros vacíos)', async () => {
    type VM = { q: any; page: number; data: BloqueList[]; count: number; loading: boolean; error: any };

    const emissions = await firstValueFrom(component.vm$.pipe(take(2), toArray()));
    expect(emissions.length).toBe(2);

    const loading = emissions[0] as VM;
    const ready   = emissions[1] as VM;

    expect(api.consolidacion).toHaveBeenCalled();
    const args = api.consolidacion.calls.mostRecent().args[0] as any;
    expect(args.page).toBe(1);
    expect(args.page_size).toBe(component.ROWS);
    // no enviar filtros vacíos
    expect('fecha' in args).toBeFalse();
    expect('chofer_nombre' in args).toBeFalse();
    expect('estado' in args).toBeFalse();

    expect(loading.loading).toBeTrue();
    expect(ready.loading).toBeFalse();
    expect(ready.count).toBe(1);
    expect(ready.page).toBe(1);
    expect(ready.data.length).toBe(1);
  });

  it('onFilters aplica filtros (trim) y resetea page=1 (sin merge)', () => {
    component.onFilters({ fecha: ' 2025-08-12 ', chofer_nombre: '  Luis ', estado: '' });

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining<NavigationExtras>({
        relativeTo: routeStub,
        queryParams: { fecha: '2025-08-12', chofer_nombre: 'Luis', page: 1 }, // estado vacío no viaja
      })
    );
  });

  it('onCleared limpia filtros y deja solo page=1 (sin merge)', () => {
    component.onCleared();

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining<NavigationExtras>({
        relativeTo: routeStub,
        queryParams: { page: 1 },
      })
    );
  });

  it('onPage navega a page (index + 1) manteniendo filtros actuales', () => {
    // 👇 TIPADO CORRECTO: estado como literal
    const q = { fecha: '2025-08-10', chofer_nombre: 'Ana', estado: 'COM' as const };

    component.onPage({ pageIndex: 2, pageSize: 5 }, q); // -> page 3

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining<NavigationExtras>({
        relativeTo: routeStub,
        queryParams: { fecha: '2025-08-10', chofer_nombre: 'Ana', estado: 'COM', page: 3 },
      })
    );
  });

  it('firstOf calcula inicio correcto', () => {
    expect(component.firstOf(1)).toBe(0);
    expect(component.firstOf(2)).toBe(5);
    expect(component.firstOf(4)).toBe(15);
    expect(component.firstOf(undefined as any)).toBe(0);
  });

  it('gotoDetail navega a /consolidacion/:id', () => {
    component.gotoDetail('abc-123');
    expect(router.navigate).toHaveBeenCalledWith(['/consolidacion', 'abc-123']);
  });

  it('columna fecha: template devuelve string legible', () => {
    const row: BloqueList = {
      id: 'x',
      fecha: '2025-08-10T10:00:00.000Z',
      chofer: null,
      chofer_nombre: 'Ana',
      total_ordenes: 1,
      estado_completitud: 'COM',
      estado_completitud_label: 'Completo',
    };
    const col = component.columns.find(c => c.field === 'fecha')!;
    const out = col.template!(row);
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });
});
