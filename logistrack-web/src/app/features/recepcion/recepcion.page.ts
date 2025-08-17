import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';

import { FiltersBarComponent, FilterField } from '../../shared/ui/filters-bar/filters-bar.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { TableComponent, TableColumn } from '../../shared/ui/table/table.component';

import { ReadApi } from '../read-api.service';
import { Recepcion, Page as P } from '../../shared/types/read-model';

type Vm = {
  q: { cd?: string; incidencias?: boolean };
  page: number;
  ordering: string;
  sortField: string | null;
  sortOrder: 1 | -1 | 0;
  data: Recepcion[];
  count: number;
  loading: boolean;
  error: any | null;
};

@Component({
  standalone: true,
  selector: 'app-recepcion',
  imports: [CommonModule, FiltersBarComponent, EmptyStateComponent, ErrorStateComponent, TableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recepcion.page.html',
})
export class RecepcionPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ReadApi);
  private lastParamsJson = '';

  readonly ROWS = 5;

  // Filtros visibles
  fields: FilterField[] = [
    { type: 'text',    name: 'cd',         label: 'CD1,CD2,CD3,...' },
    { type: 'boolean', name: 'incidencias', label: 'Incidencias' },
  ];

  // Columnas
  columns: TableColumn<Recepcion>[] = [
    { key: 'orden_id', header: 'Orden' },
    { key: 'cd', header: 'Centro Distribucion', cell: r => r.cd?.nombre ?? '—' },
    { key: 'usuario_receptor', header: 'Usuario' },
    {
      key: 'incidencias',
      header: 'Incidencias',
      cell: r => (r.incidencias ? 'Con incidencias' : 'Sin incidencias'),
      bodyClass: r => (r.incidencias ? 'text-red-600 font-medium' : 'text-green-600 font-medium'),
    },
  ];

  private toVm(
    q: Vm['q'],
    page: number,
    ordering: string,
    sortField: string | null,
    sortOrder: 1 | -1 | 0,
    patch: Partial<Vm> = {},
  ): Vm {
    return { q, page, ordering, sortField, sortOrder, data: [], count: 0, loading: false, error: null, ...patch };
  }

  // Estado desde QueryParams
  vm$ = this.route.queryParamMap.pipe(
    map(qp => {
      const rawPage = Number(qp.get('page'));
      const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

      const q: Vm['q'] = {};
      const cd = qp.get('cd');
      if (cd && cd.trim() !== '') q.cd = cd.trim();

      const inc = qp.get('incidencias'); // 'true' | 'false' | null
      if (inc === 'true') q.incidencias = true;
      else if (inc === 'false') q.incidencias = false;

      const ordering = qp.get('ordering') || '-fecha_recepcion';
      const sortField = ordering.startsWith('-') ? ordering.slice(1) : ordering;
      const sortOrder: 1 | -1 = ordering.startsWith('-') ? -1 : 1;

      return { q, page, ordering, sortField, sortOrder };
    }),
    switchMap(({ q, page, ordering, sortField, sortOrder }) =>
      this.api.recepcion({ ...q, page, page_size: this.ROWS, ordering }).pipe(
        map((p: P<Recepcion>) => this.toVm(q, page, ordering, sortField, sortOrder, { data: p.results, count: p.count })),
        startWith(this.toVm(q, page, ordering, sortField, sortOrder, { loading: true })),
        catchError(err => of(this.toVm(q, page, ordering, sortField, sortOrder, { error: err }))),
      )
    ),
  );

  // Filtros (igual a Despacho)
  onFilters(v: Record<string, any>) {
    if (v && typeof v === 'object' && 'isTrusted' in v) return; // evita '?isTrusted=true' por eventos nativos
    const currentOrdering = this.route.snapshot.queryParamMap.get('ordering') || '-fecha_recepcion';
    const params = this.cleanParams({ ...v, page: 1, ordering: currentOrdering });
    this.navigate(params);
  }
  onCleared() {
    const currentOrdering = this.route.snapshot.queryParamMap.get('ordering') || '-fecha_recepcion';
    this.navigate({ page: 1, ordering: currentOrdering });
  }

  // Paginación (evento <app-table>)
  onPage(e: { pageIndex: number; pageSize: number; length: number }, q: Vm['q']) {
    const currentOrdering = this.route.snapshot.queryParamMap.get('ordering') || '-fecha_recepcion';
    const nextPage = (e?.pageIndex ?? 0) + 1; // 1-based para la API
    this.navigate({ ...q, page: nextPage, ordering: currentOrdering });
  }

  // Navegación sin merge + de-dupe
  private navigate(params: any) {
    const next = JSON.stringify(params);
    if (next === this.lastParamsJson) return;
    this.lastParamsJson = next;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
    });
  }

  // Helpers
  firstOf(page?: number) {
    const p = Number(page);
    return Number.isFinite(p) && p > 0 ? (p - 1) * this.ROWS : 0;
  }
  trackRow = (_: number, r: Recepcion) => r.orden_id;

  private cleanParams(obj: Record<string, any>) {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v == null) continue;
      if (typeof v === 'string') {
        const t = v.trim();
        if (t === '') continue;
        out[k] = t;
      } else {
        out[k] = v;
      }
    }
    return out;
  }
}
