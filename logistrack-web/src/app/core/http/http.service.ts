// src/app/core/http/http.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class HttpService {
  private http = inject(HttpClient);
  private base = environment.apiBase ?? '/api/v1';

  /** Une base y path con exactamente un “/” entre medio */
  private join(path: string) {
    const b = String(this.base ?? '').replace(/\/+$/, '');
    const p = String(path ?? '').replace(/^\/+/, '');
    return p ? `${b}/${p}` : b;
  }

  get<T>(path: string, q?: Record<string, any>) {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(q ?? {})) {
      if (v === undefined || v === null || v === '') continue;
      params = params.set(k, String(v));
    }
    return this.http.get<T>(this.join(path), { params });
  }
}
