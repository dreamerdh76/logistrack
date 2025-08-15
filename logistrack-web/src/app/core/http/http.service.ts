import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class HttpService {
  private http = inject(HttpClient);
  private base = environment.apiBase ?? '/api/v1';

  get<T>(path: string, q?: Record<string, any>) {
    let params = new HttpParams();
    Object.entries(q ?? {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      params = params.set(k, String(v));
    });
    return this.http.get<T>(`${this.base}${path}`, { params });
  }
}
