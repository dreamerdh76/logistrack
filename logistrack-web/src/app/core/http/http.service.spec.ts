// src/app/core/http/http.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpService } from './http.service';
import { environment } from '../../../environments/environment';

describe('HttpService', () => {
  let service: HttpService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),          // <- cliente real
        provideHttpClientTesting(),   // <- backend de prueba que intercepta
      ],
    });

    service = TestBed.inject(HttpService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify(); // no debe quedar ninguna request pendiente
  });

  it('debe concatenar la base y filtrar params vacíos', () => {
    const base = environment.apiBase ?? '/api/v1';
    let resp: any;

    service.get<{ ok: boolean }>('/ordenes', {
      a: 1,
      b: '',        // se ignora
      c: null,      // se ignora
      d: undefined, // se ignora
      e: false,     // debe conservarse como "false"
      f: 0,         // debe conservarse como "0"
    }).subscribe(r => (resp = r));

    const req = httpMock.expectOne(r =>
      r.url === `${base}/ordenes` &&
      r.params.get('a') === '1' &&
      r.params.get('e') === 'false' &&
      r.params.get('f') === '0' &&
      !r.params.has('b') && !r.params.has('c') && !r.params.has('d')
    );

    expect(req.request.method).toBe('GET');
    req.flush({ ok: true });

    expect(resp.ok).toBeTrue();
  });

  it('normaliza base con slash final (evita //)', () => {
    (service as any).base = '/api/v1/';
    service.get('ping').subscribe();
    const req = httpMock.expectOne((r) => r.url.endsWith('/api/v1/ping'));
    expect(req.request.url.endsWith('/api/v1/ping')).toBeTrue();
    req.flush({});
  });

});
