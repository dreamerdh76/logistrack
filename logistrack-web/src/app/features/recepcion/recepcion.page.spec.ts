// src/app/features/recepcion/recepcion.page.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap, NavigationExtras } from '@angular/router';
import { BehaviorSubject, firstValueFrom, of, take, toArray, throwError } from 'rxjs';

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
    return Object.entries(v)
      .filter(([, on]) => !!on)
      .map(([k]) => k)
      .join(' ');
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
    // incidencias ausente => null en la página
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

  it('vm$ emite loading y luego datos', async () => {
    type VM = { q: any; data: Recepcion[]; count: number; loading: boolean; error: any };

    const [loading, ready] = await firstValueFrom(
      component.vm$.pipe(take(2), toArray())
    ) as [VM, VM];

    expect(api.recepcion).toHaveBeenCalledWith({ cd: undefined, incidencias: undefined, page: 1 });
    expect(loading.loading).toBeTrue();
    expect(ready.loading).toBeFalse();
    expect(ready.count).toBe(2);
    expect(ready.q.ordering).toBe('-fecha_recepcion');
  });

  it('cuando la API falla, vm$ expone error y data vacía', async () => {
    api.recepcion.and.returnValue(throwError(() => new Error('falló')));

    type VM = { loading: boolean; error: any; data: Recepcion[]; q: any };

    // ⬇️ Evita el cast a tupla directo
    const emissions = await firstValueFrom(component.vm$.pipe(take(2), toArray()));
    const loading  = emissions[0] as VM;
    const errorVm  = emissions[1] as VM;

    expect(loading.loading).toBeTrue();
    expect(errorVm.loading).toBeFalse();
    expect(errorVm.error).toBeTruthy();
    expect(errorVm.data.length).toBe(0);
  });

  it('onFilters aplica cd/incidencias y resetea page=1', () => {
    component.onFilters({ cd: 'CD9', incidencias: true });

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining<NavigationExtras>({
        relativeTo: routeStub,
        queryParamsHandling: 'merge',
        queryParams: { cd: 'CD9', incidencias: true, page: 1 },
      })
    );
  });

  it('onCleared limpia filtros y page=1', () => {
    component.onCleared();

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining<NavigationExtras>({
        relativeTo: routeStub,
        queryParamsHandling: 'merge',
        queryParams: { cd: null, incidencias: null, page: 1 },
      })
    );
  });

  it('onPage navega a page (index + 1) manteniendo query', () => {
    const q = { cd: 'CD1', incidencias: false, page: 1, ordering: '-fecha_recepcion' };
    component.onPage({ pageIndex: 3, pageSize: 5, length: 20 } as any, q); // -> page 4

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining<NavigationExtras>({
        relativeTo: routeStub,
        queryParamsHandling: 'merge',
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

    // cell
    expect(incCol.cell!(sinInc)).toBe('Sin incidencias');
    expect(incCol.cell!(conInc)).toBe('Con incidencias');

    // bodyClass puede ser función o valor
    const redRaw   = typeof incCol.bodyClass === 'function' ? incCol.bodyClass(conInc) : incCol.bodyClass;
    const greenRaw = typeof incCol.bodyClass === 'function' ? incCol.bodyClass(sinInc) : incCol.bodyClass;

    expect(classToString(redRaw as any)).toContain('text-red-600');
    expect(classToString(greenRaw as any)).toContain('text-green-600');

    // cd cell
    expect(cdCol.cell!(sinInc)).toBe('CD Norte');
    expect(cdCol.cell!(conInc)).toBe('—'); // cuando no hay CD
  });
});
