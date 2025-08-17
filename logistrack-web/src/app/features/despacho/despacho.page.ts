// src/app/features/despacho/despacho.page.ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';

import { FiltersBarComponent, FilterField } from '../../shared/ui/filters-bar/filters-bar.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { TableComponent, TableColumn } from '../../shared/ui/table/table.component';
import { ReadApi } from '../read-api.service';
import { Orden, Page as P } from '../../shared/types/read-model';

type Vm = {
  q: Record<string, any>;
  page: number;
  data: Orden[];
  count: number;
  loading: boolean;
  error: any | null;
};
const toVm = (q: any, page: number, patch: Partial<Vm> = {}): Vm => ({
  q,
  page,
  data: [],
  count: 0,
  loading: false,
  error: null,
  ...patch,
});
@Component({
  standalone: true,
  selector: 'app-despacho',
  imports: [CommonModule, FiltersBarComponent, EmptyStateComponent, ErrorStateComponent, TableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './despacho.page.html',
})
export class DespachoPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ReadApi);
  private lastParamsJson = '';
  readonly ROWS = 5;

  // Filtros visibles
  fields: FilterField[] = [
    { type: 'text', name: 'cd',      label: 'CD1,CD2,CD3,...' },
    { type: 'text', name: 'pyme', label: 'PyME' },
  ];

  // Columnas (minis anidados)
  columns: TableColumn<Orden>[] = [
    { key: 'id', header: 'Orden',    cell: r => r.id },
    { key: 'pyme', header: 'PyME',   cell: r => r.pyme?.nombre ?? '—' },
    { key: 'origen_cd',  header: 'Origen',  cell: r => r.origen_cd?.nombre ?? '—' },
    { key: 'destino_cd', header: 'Destino', cell: r => r.destino_cd?.nombre ?? '—' },
    { key: 'fecha_despacho', header: 'Fecha', cell: r => new Date(r.fecha_despacho).toLocaleString() },
  ];


  // Estado de la página desde QueryParams
  vm$ = this.route.queryParamMap.pipe(
    map((qp) => {
      const raw = Number(qp.get('page'));
      const page = Number.isFinite(raw) && raw > 0 ? raw : 1;

      const q: any = {};
      const cd = qp.get('cd');
      if (cd && cd.trim() !== '') q.cd = cd;

      const pyme = qp.get('pyme');
      if (pyme && pyme.trim() !== '') q.pyme = pyme;

      return { q, page };
    }),
    switchMap(({ q, page }) =>
      this.api.despacho({ ...q, page, page_size: this.ROWS }).pipe(
        map((p) => toVm(q, page, { data: p.results, count: p.count })),
        startWith(toVm(q, page, { loading: true })),
        catchError((err) => of(toVm(q, page, { error: err }))),
      )
    ),
  );

  onFilters(v: any) {
    if (v && typeof v === 'object' && 'isTrusted' in v) return; // evita '?isTrusted=true'
    const params = this.cleanParams({ ...v, page: 1 });
    this.navigate(params);
  }
  onCleared() {
    this.navigate({ page: 1 }); // sin filtros => se eliminan de la URL
  }


  onPage(e: { pageIndex: number; pageSize: number }, q: any) {
    const nextPage = (e?.pageIndex ?? 0) + 1; // 1-based para tu API
    this.navigate({ ...q, page: nextPage });
  }

  private navigate(params: any) {
    const next = JSON.stringify(params);
    if (next === this.lastParamsJson) return; // evita navegación redundante
    this.lastParamsJson = next;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params
    });
  }

  firstOf(page?: number) {
    const p = Number(page);
    return Number.isFinite(p) && p > 0 ? (p - 1) * this.ROWS : 0;
  }
  private cleanParams(obj: Record<string, any>) {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v == null) continue;                       // null/undefined -> fuera
      if (typeof v === 'string') {
        const t = v.trim();
        if (t === '') continue;                      // string vacío -> fuera
        out[k] = t;
      } else {
        out[k] = v;                                  // number/boolean/date/etc -> se queda
      }
    }
    return out;
  }
}

