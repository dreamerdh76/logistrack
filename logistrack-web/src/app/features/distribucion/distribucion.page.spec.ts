// src/app/features/distribucion/distribucion.page.spec.ts
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, NavigationExtras } from '@angular/router';
import { BehaviorSubject, firstValueFrom, of, take, toArray, throwError } from 'rxjs';
import { provideZonelessChangeDetection } from '@angular/core';

import { DistribucionPage } from './distribucion.page';
import { ReadApi } from '../read-api.service';
import { Distribucion, Page } from '../../shared/types/read-model';

class MockReadApi {
  distribucion = jasmine.createSpy('distribucion').and.returnValue(
    of<Page<Distribucion>>({
      count: 2,
      next: null,
      previous: null,
      results: [
        { orden_id: 'o-1', estado: 'PEN', estado_label: 'Pendiente', fecha_entrega: null, chofer_id: null },
        { orden_id: 'o-2', estado: 'ENT', estado_label: 'Entregada', fecha_entrega: '2025-08-12T12:00:00.000Z', chofer_id: 'c-1' },
      ],
    })
  );
}

describe('DistribucionPage (standalone, zoneless)', () => {
  let component: DistribucionPage;
  let router: jasmine.SpyObj<Router>;
  let api: MockReadApi;
  let q$: BehaviorSubject<any>;
  let routeStub: any;

  beforeEach(async () => {
    q$ = new BehaviorSubject(convertToParamMap({ estado: '', page: '1', ordering: '-fecha_entrega' }));
    routeStub = { queryParamMap: q$.asObservable(), snapshot: { queryParamMap: q$.value } };

    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [DistribucionPage],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ActivatedRoute, useValue: routeStub },
        { provide: Router, useValue: router },
        { provide: ReadApi, useClass: MockReadApi },
      ],
    }).compileComponents();

    api = TestBed.inject(ReadApi) as unknown as MockReadApi;
    component = TestBed.createComponent(DistribucionPage).componentInstance;
  });

  it('debe crearse', () => {
    expect(component).toBeTruthy();
  });

  it('vm$ emite loading y luego datos', async () => {
    type VM = { q: any; data: Distribucion[]; count: number; loading: boolean; error: any };

    const emissions = await firstValueFrom(component.vm$.pipe(take(2), toArray())) as VM[];
    expect(emissions.length).toBe(2);
    const [loading, ready] = emissions as [VM, VM];

    expect(api.distribucion).toHaveBeenCalledWith({ estado: undefined, page: 1 });
    expect(loading.loading).toBeTrue();
    expect(ready.loading).toBeFalse();
    expect(ready.count).toBe(2);
    expect(ready.q.ordering).toBe('-fecha_entrega');
  });


  it('cuando la API falla, vm$ expone error y no data', async () => {
    api.distribucion.and.returnValue(throwError(() => new Error('falló')));

    type VM = { loading: boolean; error: any; data: Distribucion[]; q: any };
    const emissions = await firstValueFrom(component.vm$.pipe(take(2), toArray())) as VM[];
    expect(emissions.length).toBe(2);
    const [loading, errorVm] = emissions as [VM, VM];

    expect(loading.loading).toBeTrue();
    expect(errorVm.loading).toBeFalse();
    expect(errorVm.error).toBeTruthy();
    expect(errorVm.data.length).toBe(0);
  });

  it('onFilters aplica estado y resetea page=1', () => {
    component.onFilters({ estado: 'ENT' });

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining<NavigationExtras>({
        relativeTo: routeStub,
        queryParamsHandling: 'merge',
        queryParams: { estado: 'ENT', page: 1 },
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
    const q = { estado: 'PEN', page: 1, ordering: '-fecha_entrega' };
    component.onPage({ pageIndex: 2, pageSize: 5, length: 10 } as any, q); // -> page 3

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining<NavigationExtras>({
        relativeTo: routeStub,
        queryParamsHandling: 'merge',
        queryParams: { estado: 'PEN', page: 3, ordering: '-fecha_entrega' },
      })
    );
  });

  it('firstOf calcula el índice inicial', () => {
    expect(component.firstOf(1)).toBe(0);
    expect(component.firstOf(2)).toBe(5);
    expect(component.firstOf(undefined as any)).toBe(0);
  });

  it('trackRow devuelve el id de la orden', () => {
    const r: Distribucion = { orden_id: 'o-x', estado: 'REJ', estado_label: 'Rechazada', fecha_entrega: null, chofer_id: null };
    expect(component.trackRow(0, r)).toBe('o-x');
  });

  it('columnas: cell y clases por estado', () => {
    const pen: Distribucion = { orden_id: 'o-1', estado: 'PEN', estado_label: 'Pendiente', fecha_entrega: null, chofer_id: null };
    const ent: Distribucion = { orden_id: 'o-2', estado: 'ENT', estado_label: 'Entregada', fecha_entrega: '2025-08-12T12:00:00.000Z', chofer_id: 'c-1' };
    const rej: Distribucion = { orden_id: 'o-3', estado: 'REJ', estado_label: 'Rechazada', fecha_entrega: null, chofer_id: null };

    const estadoCol = component.columns.find(c => c.header === 'Estado')!;
    const fechaCol  = component.columns.find(c => c.header === 'Fecha entrega')!;

    // cell
    expect(estadoCol.cell!(pen)).toBe('Pendiente');
    expect(estadoCol.cell!(ent)).toBe('Entregada');
    expect(estadoCol.cell!(rej)).toBe('Rechazada');
    expect(typeof fechaCol.cell!(ent)).toBe('string');
    expect(fechaCol.cell!(pen)).toBe('—');

    // bodyClass puede ser string o función -> normaliza a función
    const toClass = (estadoCol.bodyClass
      ? (typeof estadoCol.bodyClass === 'function'
          ? estadoCol.bodyClass
          : () => String(estadoCol.bodyClass))
      : () => '') as (r: Distribucion) => string;

    expect(toClass(ent)).toContain('text-green-600');
    expect(toClass(rej)).toContain('text-red-600');
    expect(toClass(pen)).toContain('text-amber-600');
  });
});
