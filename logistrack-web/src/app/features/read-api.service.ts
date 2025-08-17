import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { HttpService } from '../core/http/http.service';
import {
  Page,
  Orden,
  BloqueList,
  BloqueDetail,
  Recepcion,
  Distribucion,
  EstadoPrep,
  EstadoBloque,
  EstadoDistrib,
} from '../shared/types/read-model';

// Index genérico para componer la key del caché
type Q = Record<string, string | number | boolean | undefined>;

// 👇 Tipo base reutilizable para query string
type Paging = {
  page?: number;
  page_size?: number;   // ✅ ya permitido en todos los endpoints que lo usen
  ordering?: string;    // ✅ opcional si necesitas ordenamiento
};
type WithPaging<T> = T & Paging;

@Injectable({ providedIn: 'root' })
export class ReadApi {
  private http = inject(HttpService);
  private cache = new Map<string, Observable<unknown>>(); // cache por URL+qs

  // --- helpers ---
  private key(path: string, q?: Q) {
    return path + '::' + JSON.stringify(q ?? {});
  }

  private getCached<T>(path: string, q?: Q): Observable<T> {
    const k = this.key(path, q);
    if (!this.cache.has(k)) {
      const obs = this.http.get<T>(path, q).pipe(shareReplay(1));
      this.cache.set(k, obs as unknown as Observable<unknown>);
    }
    return this.cache.get(k)! as Observable<T>;
  }

  clearCache(prefix?: string) {
    if (!prefix) return this.cache.clear();
    [...this.cache.keys()].forEach(k => k.startsWith(prefix) && this.cache.delete(k));
  }

  // --- endpoints ---

  despacho(q: WithPaging<{ cd?: string; pyme?: string }>): Observable<Page<Orden>> {
    return this.getCached<Page<Orden>>('/despacho/ordenes', q);
  }

  preparacion(q: WithPaging<{ estado?: EstadoPrep; desde?: string; hasta?: string }>): Observable<Page<Orden>> {
    return this.getCached<Page<Orden>>('/preparacion/ordenes', q);
  }

  expedicion(q: WithPaging<{ chofer_id?: string; fecha?: string }>): Observable<Page<Orden>> {
    return this.getCached<Page<Orden>>('/expedicion/ordenes', q);
  }

  recepcion(q: WithPaging<{ cd?: string; incidencias?: boolean }>): Observable<Page<Recepcion>> {
    return this.getCached<Page<Recepcion>>('/recepcion/ordenes', q);
  }

  consolidacion(q: WithPaging<{ fecha?: string; chofer_nombre?: string; estado?: EstadoBloque }>): Observable<Page<BloqueList>> {
    return this.getCached<Page<BloqueList>>('/consolidacion/bloques', q);
  }

  bloqueDetalle(id: string): Observable<BloqueDetail> {
    return this.getCached<BloqueDetail>(`/consolidacion/bloques/${id}`);
  }

  distribucion(q: WithPaging<{ estado?: EstadoDistrib }>): Observable<Page<Distribucion>> {
    return this.getCached<Page<Distribucion>>('/distribucion/ordenes', q);
  }
}
