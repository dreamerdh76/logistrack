// src/app/features/despacho/despacho.page.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { DespachoPage } from './despacho.page';
import { ReadApi } from '../read-api.service';

describe('DespachoPage', () => {
  let api: jasmine.SpyObj<ReadApi>;

  beforeEach(async () => {
    api = jasmine.createSpyObj('ReadApi', ['despacho']);
    api.despacho.and.returnValue(
      of({
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: 'o-1',
            pyme_id: 'p-1',
            origen_cd_id: 'cd-a',
            destino_cd_id: 'cd-b',
            fecha_despacho: new Date().toISOString(),
            estado_preparacion: 'PEN',
            peso_total: 1,
            volumen_total: 1,
            chofer_id: null,
          },
        ],
      }),
    );

    await TestBed.configureTestingModule({
      imports: [DespachoPage], // componente standalone
      providers: [
        // define una ruta mínima para poder navegar en el test
        provideRouter(
          [{ path: 'despacho', component: DespachoPage }],
          withComponentInputBinding(),
        ),
        provideNoopAnimations(),
        { provide: ReadApi, useValue: api },
      ],
    }).compileComponents();
  });

  it('lee query params y llama ReadApi.despacho con filtros y page', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      '/despacho?cd_id=cd-1&pyme_id=p-1&desde=2025-08-01&page=2',
    );

    expect(api.despacho).toHaveBeenCalledWith(
      jasmine.objectContaining({
        cd_id: 'cd-1',
        pyme_id: 'p-1',
        desde: '2025-08-01',
        page: 2,
      }),
    );
  });

  it('onFilters navega con page=1 y filtros aplicados', () => {
    const fixture = TestBed.createComponent(DespachoPage);
    const cmp = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const spyNav = spyOn(router, 'navigate');

    cmp.onFilters({
      cd_id: 'cd-1',
      pyme_id: 'p-2',
      desde: '2025-08-01',
      hasta: '',
    });

    expect(spyNav).toHaveBeenCalledWith([], {
      relativeTo: jasmine.anything(),
      queryParams: jasmine.objectContaining({
        cd_id: 'cd-1',
        pyme_id: 'p-2',
        desde: '2025-08-01',
        page: 1,
      }),
      queryParamsHandling: 'merge',
    });
  });

  it('onPage avanza página y conserva filtros', () => {
    const fixture = TestBed.createComponent(DespachoPage);
    const cmp = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const spyNav = spyOn(router, 'navigate');

    const q = {
      cd_id: 'cd-1',
      pyme_id: 'p-1',
      desde: '',
      hasta: '',
      page: 1,
      ordering: '-fecha_despacho',
    };
    cmp.onPage({ pageIndex: 2, pageSize: 20, length: 100 } as any, q);

    expect(spyNav).toHaveBeenCalledWith([], {
      relativeTo: jasmine.anything(),
      queryParams: jasmine.objectContaining({
        cd_id: 'cd-1',
        pyme_id: 'p-1',
        page: 3,
      }),
      queryParamsHandling: 'merge',
    });
  });
});
