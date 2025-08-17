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

type EstadoPrep = 'PEN' | 'COM';
type Vm = {
  q: { estado?: EstadoPrep };
  page: number;
  ordering: string;
  sortField: string | null;
  sortOrder: 1 | -1 | 0;
  data: Orden[];
  count: number;
  loading: boolean;
  error: any | null;
};

@Component({
  standalone: true,
  selector: 'app-preparacion',
  imports: [CommonModule, FiltersBarComponent, EmptyStateComponent, ErrorStateComponent, TableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './preparacion.page.html',
})
export class PreparacionPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ReadApi);
  private lastParamsJson = '';

  readonly ROWS = 5;

  // Filtros visibles
  fields: FilterField[] = [
    {
      type: 'select',
      name: 'estado',
      label: 'Estado',
      options: [
        { value: 'PEN', label: 'Pendiente' },
        { value: 'COM', label: 'Completa'  },
      ],
    },
  ];

  // Columnas
  columns: TableColumn<Orden>[] = [
    { key: 'id', header: 'Orden' },
    {
      key: 'estado_preparacion',
      header: 'Estado',
      template: (r: Orden) => (r.estado_preparacion === 'COM' ? 'Completa' : 'Pendiente'),
      bodyClass: (r: Orden) =>
        r.estado_preparacion === 'COM'
          ? 'text-green-600 font-medium'
          : 'text-red-600 font-medium',
    },
    { key: 'peso_total', header: 'Peso' },
    { key: 'volumen_total', header: 'Volumen' },
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

  // Estado desde query params
  vm$ = this.route.queryParamMap.pipe(
    map(qp => {
      const raw = Number(qp.get('page'));
      const page = Number.isFinite(raw) && raw > 0 ? raw : 1;

      const q: Vm['q'] = {};
      const estado = qp.get('estado');
      if (estado && estado.trim() !== '') q.estado = estado.trim() as EstadoPrep;

      const ordering = qp.get('ordering') || '-fecha_despacho';
      const sortField = ordering.startsWith('-') ? ordering.slice(1) : ordering;
      const sortOrder: 1 | -1 = ordering.startsWith('-') ? -1 : 1;

      return { q, page, ordering, sortField, sortOrder };
    }),
    switchMap(({ q, page, ordering, sortField, sortOrder }) =>
      this.api.preparacion({ ...q, page, page_size: this.ROWS, ordering }).pipe(
        map((p: P<Orden>) => this.toVm(q, page, ordering, sortField, sortOrder, { data: p.results, count: p.count })),
        startWith(this.toVm(q, page, ordering, sortField, sortOrder, { loading: true })),
        catchError(err => of(this.toVm(q, page, ordering, sortField, sortOrder, { error: err }))),
      )
    ),
  );

  // Filtros (igual a Despacho)
  onFilters(v: Record<string, any>) {
    if (v && typeof v === 'object' && 'isTrusted' in v) return; // evita '?isTrusted=true'
    const currentOrdering = this.route.snapshot.queryParamMap.get('ordering') || '-fecha_despacho';
    const params = this.cleanParams({ ...v, page: 1, ordering: currentOrdering });
    this.navigate(params);
  }
  onCleared() {
    const currentOrdering = this.route.snapshot.queryParamMap.get('ordering') || '-fecha_despacho';
    this.navigate({ page: 1, ordering: currentOrdering });
  }

  // Evento del <app-table>
  onPage(e: { pageIndex: number; pageSize: number; length: number }, q: Vm['q']) {
    const currentOrdering = this.route.snapshot.queryParamMap.get('ordering') || '-fecha_despacho';
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
  trackRow = (_: number, r: Orden) => r.id;

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
