// src/app/features/read-api.service.spec.ts
import { TestBed } from '@angular/core/testing';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ReadApi } from './read-api.service';

describe('ReadApi', () => {
  let api: ReadApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ReadApi, provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ReadApi);
    http = TestBed.inject(HttpTestingController);
  });

  it('despacho: construye query params correctos', () => {
    api
      .despacho({ cd_id: 'cd-1', pyme_id: 'p-1', desde: '2025-08-01', page: 2 })
      .subscribe();
    const req = http.expectOne(
      (r) =>
        r.url.endsWith('/api/v1/despacho/ordenes') &&
        r.params.get('cd_id') === 'cd-1' &&
        r.params.get('pyme_id') === 'p-1' &&
        r.params.get('desde') === '2025-08-01' &&
        r.params.get('page') === '2',
    );
    req.flush({ count: 0, next: null, previous: null, results: [] });
    http.verify();
  });
});
