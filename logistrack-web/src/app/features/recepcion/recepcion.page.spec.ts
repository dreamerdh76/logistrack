// src/app/features/recepcion/recepcion.page.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap, NavigationExtras } from '@angular/router';
import { BehaviorSubject, of, throwError, firstValueFrom, pairwise, take } from 'rxjs';

import { RecepcionPage } from './recepcion.page';
import { ReadApi } from '../read-api.service';
import { Page, Recepcion } from '../../shared/types/read-model';

// ---------- helpers ----------
const makeRecep = (p: Partial<Recepcion> = {}): Recepcion => ({
  orden_id: 'o-1',
  cd: { id: 'cd-1', nombre: 'CD Norte' },
  fecha_recepcion: '2025-08-12T10:00:00.000Z' as any,
  usuario_receptor: 'user@test',
  incidencias: false,
  ...p,
});

type ClassVal = string | string[] | Record<string, boolean> | null | undefined;
const classToString = (v: ClassVal): string => {
  if (!v) return '';
  if (Array.isArray(v)) return v.map(classToString as any).join(' ');
  if (typeof v === 'object') {
    return Object.entries(v).filter(([, on]) => !!on).map(([k]) => k).join(' ');
  }
  return String(v);
};

// ---------- Mock API ----------
class MockReadApi {
  recepcion = jasmine.createSpy('recepcion').and.returnValue(
    of<Page<Recepcion>>({
      count: 2,
      next: null,
      previous: null,
      results: [
        makeRecep({ orden_id: 'o-1', incidencias: false }),
        makeRecep({ orden_id: 'o-2', incidencias: true, cd: null as any }),
      ],
    })
  );
}

describe('RecepcionPage (standalone, zoneless)', () => {
  let component: RecepcionPage;
  let router: jasmine.SpyObj<Router>;
  let api: MockReadApi;
  let q$: BehaviorSubject<any>;
  let routeStub: any;

  beforeEach(async () => {
    q$ = new BehaviorSubject(convertToParamMap({
      page: '1',
      cd: '',
      ordering: '-fecha_recepcion',
    }));
    routeStub = { queryParamMap: q$.asObservable(), snapshot: { queryParamMap: q$.value } };

    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [RecepcionPage],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ActivatedRoute, useValue: routeStub },
        { provide: Router, useValue: router },
        { provide: ReadApi, useClass: MockReadApi },
      ],
    }).compileComponents();

    api = TestBed.inject(ReadApi) as unknown as MockReadApi;
    component = TestBed.createComponent(RecepcionPage).componentInstance;
  });

  it('debe crearse', () => {
    expect(component).toBeTruthy();
  });

  it('vm$ emite loading y luego datos; la API recibe page, page_size y ordering (sin filtros vacíos); ordering queda en VM', async () => {
    type VM = { q:any; data:Recepcion[]; count:number; loading:boolean; error:any; page:number; ordering:string };

    const [loading, ready] = await firstValueFrom(
      component.vm$.pipe(pairwise(), take(1))
    ) as [VM, VM];

    // API: ahora envía page, page_size y ordering
    expect(api.recepcion).toHaveBeenCalled();
    const args = api.recepcion.calls.mostRecent().args[0] as any;
    expect(args.page).toBe(1);
    expect(args.page_size).toBe(component.ROWS);
    expect(args.ordering).toBe('-fecha_recepcion');
    // filtros vacíos no viajan
    expect('cd' in args).toBeFalse();
    expect('incidencias' in args).toBeFalse();

    expect(loading.loading).toBeTrue();
    expect(ready.loading).toBeFalse();
    expect(ready.count).toBe(2);
    expect(ready.page).toBe(1);
    // ordering está al tope de la VM (no dentro de q)
    expect(ready.ordering).toBe('-fecha_recepcion');
  });

  it('cuando la API falla, vm$ expone error y data vacía', async () => {
    api.recepcion.and.returnValue(throwError(() => new Error('falló')));

    type VM = { loading:boolean; error:any; data:Recepcion[]; count:number };

    const [loading, errorVm] = await firstValueFrom(
      component.vm$.pipe(pairwise(), take(1))
    ) as [VM, VM];

    expect(loading.loading).toBeTrue();
    expect(errorVm.loading).toBeFalse();
    expect(errorVm.error).toBeTruthy();
    expect(errorVm.data.length).toBe(0);
  });

  it('onFilters aplica cd/incidencias, resetea page=1 y conserva ordering (sin merge)', () => {
    component.onFilters({ cd: 'CD9', incidencias: true });

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining<NavigationExtras>({
        relativeTo: routeStub,
        // sin queryParamsHandling
        queryParams: { cd: 'CD9', incidencias: true, page: 1, ordering: '-fecha_recepcion' },
      })
    );
  });

  it('onCleared limpia filtros y deja page=1 conservando ordering (sin merge)', () => {
    component.onCleared();

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining<NavigationExtras>({
        relativeTo: routeStub,
        queryParams: { page: 1, ordering: '-fecha_recepcion' },
      })
    );
  });

  it('onPage navega a page (index + 1) manteniendo query (sin merge)', () => {
    const q = { cd: 'CD1', incidencias: false, page: 1, ordering: '-fecha_recepcion' };
    component.onPage({ pageIndex: 3, pageSize: 5, length: 20 } as any, q); // -> page 4

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining<NavigationExtras>({
        relativeTo: routeStub,
        queryParams: { cd: 'CD1', incidencias: false, page: 4, ordering: '-fecha_recepcion' },
      })
    );
  });

  it('firstOf calcula índice inicial con ROWS=5', () => {
    expect(component.firstOf(1)).toBe(0);
    expect(component.firstOf(2)).toBe(5);
    expect(component.firstOf(undefined as any)).toBe(0);
  });

  it('trackRow devuelve el id de la orden', () => {
    const r = makeRecep({ orden_id: 'o-x' });
    expect(component.trackRow(0, r)).toBe('o-x');
  });

  it('columnas: cell y clases por incidencias', () => {
    const sinInc = makeRecep({ incidencias: false });
    const conInc = makeRecep({ incidencias: true, cd: null as any });

    const incCol = component.columns.find(c => c.header === 'Incidencias')!;
    const cdCol  = component.columns.find(c => c.header === 'Centro Distribucion')!;

    expect(incCol.cell!(sinInc)).toBe('Sin incidencias');
    expect(incCol.cell!(conInc)).toBe('Con incidencias');

    const redRaw   = typeof incCol.bodyClass === 'function' ? incCol.bodyClass(conInc) : incCol.bodyClass;
    const greenRaw = typeof incCol.bodyClass === 'function' ? incCol.bodyClass(sinInc) : incCol.bodyClass;

    expect(classToString(redRaw as any)).toContain('text-red-600');
    expect(classToString(greenRaw as any)).toContain('text-green-600');

    expect(cdCol.cell!(sinInc)).toBe('CD Norte');
    expect(cdCol.cell!(conInc)).toBe('—');
  });
});
