import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
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

type Q = Record<string, string | number | boolean | undefined>;

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
    [...this.cache.keys()].forEach(
      (k) => k.startsWith(prefix) && this.cache.delete(k),
    );
  }

  // --- endpoints ---

  despacho(q: {
    cd?: string;
    pyme_id?: string;
    page?: number;
  }): Observable<Page<Orden>> {
    return this.getCached<Page<Orden>>('/despacho/ordenes', q);
  }

  preparacion(q: {
    estado?: EstadoPrep;
    desde?: string;
    hasta?: string;
    page?: number;
  }): Observable<Page<Orden>> {
    return this.getCached<Page<Orden>>('/preparacion/ordenes', q);
  }

  expedicion(q: {
    chofer_id?: string;
    fecha?: string;
    page?: number;
  }): Observable<Page<Orden>> {
    return this.getCached<Page<Orden>>('/expedicion/ordenes', q);
  }

  recepcion(q: {
    cd_id?: string;
    incidencias?: boolean;
    desde?: string;
    hasta?: string;
    page?: number;
  }): Observable<Page<Recepcion>> {
    return this.getCached<Page<Recepcion>>('/recepcion/ordenes', q);
  }

  consolidacion(q: {
    fecha?: string;
    chofer_nombre?: string;
    estado?: EstadoBloque;
    page?: number;
  }): Observable<Page<BloqueList>> {
    return this.getCached<Page<BloqueList>>('/consolidacion/bloques', q);
  }

  bloqueDetalle(id: string): Observable<BloqueDetail> {
    return this.getCached<BloqueDetail>(`/consolidacion/bloques/${id}`);
  }

  distribucion(q: {
    estado?: EstadoDistrib;
    chofer_id?: string;
    desde?: string;
    hasta?: string;
    page?: number;
  }): Observable<Page<Distribucion>> {
    return this.getCached<Page<Distribucion>>('/distribucion/ordenes', q);
  }
}
