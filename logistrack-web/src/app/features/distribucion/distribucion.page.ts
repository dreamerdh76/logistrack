import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';

import { FiltersBarComponent, FilterField } from '../../shared/ui/filters-bar/filters-bar.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { TableComponent, TableColumn } from '../../shared/ui/table/table.component';

import { ReadApi } from '../read-api.service';
import { Distribucion, Page as P } from '../../shared/types/read-model';

type EstadoDistrib = 'PEN' | 'ENT' | 'REJ';

type Vm = {
  q: { estado?: EstadoDistrib };
  page: number;
  ordering: string;
  sortField: string | null;
  sortOrder: 1 | -1 | 0;
  data: Distribucion[];
  count: number;
  loading: boolean;
  error: any | null;
};

@Component({
  standalone: true,
  selector: 'app-distribucion',
  imports: [CommonModule, FiltersBarComponent, EmptyStateComponent, ErrorStateComponent, TableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './distribucion.page.html',
})
export class DistribucionPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ReadApi);
  private lastParamsJson = '';

  readonly ROWS = 5;

  // -------- Filtros visibles --------
  fields: FilterField[] = [
    {
      type: 'select',
      name: 'estado',
      label: 'Estado',
      options: [
        { value: 'PEN', label: 'Pendiente' },
        { value: 'ENT', label: 'Entregada' },
        { value: 'REJ', label: 'Rechazada' },
      ],
    },
  ];

  // -------- Columnas --------
  columns: TableColumn<Distribucion>[] = [
    {
      key: 'fecha_entrega',
      header: 'Fecha entrega',
      cell: r => (r.fecha_entrega ? new Date(r.fecha_entrega).toLocaleString() : '—'),
    },
    { key: 'chofer_id', header: 'Chofer' },
    {
      key: 'estado',
      header: 'Estado',
      cell: r => r.estado_label ?? r.estado,
      bodyClass: r =>
        r.estado === 'ENT'
          ? 'text-green-600 font-medium'
          : r.estado === 'REJ'
          ? 'text-red-600 font-medium'
          : 'text-amber-600 font-medium',
    },
  ];

  // -------- Helper para VM --------
  private toVm(
    q: Vm['q'],
    page: number,
    ordering: string,
    sortField: string | null,
    sortOrder: 1 | -1 | 0,
    patch: Partial<Vm> = {},
  ): Vm {
    return {
      q,
      page,
      ordering,
      sortField,
      sortOrder,
      data: [],
      count: 0,
      loading: false,
      error: null,
      ...patch,
    };
  }

  // -------- Estado (desde query params) --------
  vm$ = this.route.queryParamMap.pipe(
    map(qp => {
      const rawPage = Number(qp.get('page'));
      const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

      const estadoRaw = qp.get('estado');
      const q: { estado?: EstadoDistrib } = {};
      if (estadoRaw && estadoRaw.trim() !== '') q.estado = estadoRaw.trim() as EstadoDistrib;

      const ordering = qp.get('ordering') || '-fecha_entrega';
      const sortField = ordering.startsWith('-') ? ordering.slice(1) : ordering;
      const sortOrder: 1 | -1 = ordering.startsWith('-') ? -1 : 1;

      return { q, page, ordering, sortField, sortOrder };
    }),
    switchMap(({ q, page, ordering, sortField, sortOrder }) =>
      this.api.distribucion({ ...q, page, page_size: this.ROWS, ordering }).pipe(
        map((p: P<Distribucion>) =>
          this.toVm(q, page, ordering, sortField, sortOrder, { data: p.results, count: p.count }),
        ),
        startWith(this.toVm(q, page, ordering, sortField, sortOrder, { loading: true })),
        catchError(err => of(this.toVm(q, page, ordering, sortField, sortOrder, { error: err }))),
      ),
    ),
  );

  // -------- Acciones --------
  onFilters(v: Record<string, any>) {
    // misma guarda que usaste en Despacho para evitar '?isTrusted=true'
    if (v && typeof v === 'object' && 'isTrusted' in v) return;
    const currentOrdering = this.route.snapshot.queryParamMap.get('ordering') || '-fecha_entrega';
    const params = this.cleanParams({ ...v, page: 1, ordering: currentOrdering });
    this.navigate(params);
  }

  onCleared() {
    const currentOrdering = this.route.snapshot.queryParamMap.get('ordering') || '-fecha_entrega';
    this.navigate({ page: 1, ordering: currentOrdering });
  }

  // Evento emitido por <app-table>: { pageIndex, pageSize, length }
  onPage(e: { pageIndex: number; pageSize: number; length: number }, q: Vm['q']) {
    const currentOrdering = this.route.snapshot.queryParamMap.get('ordering') || '-fecha_entrega';
    const nextPage = (e?.pageIndex ?? 0) + 1;
    this.navigate({ ...q, page: nextPage, ordering: currentOrdering });
  }

  // -------- Navegación con de-dupe --------
  private navigate(params: any) {
    const next = JSON.stringify(params);
    if (next === this.lastParamsJson) return;
    this.lastParamsJson = next;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
    });
  }

  // -------- Utils --------
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

  firstOf(page?: number) {
    const p = Number(page);
    return Number.isFinite(p) && p > 0 ? (p - 1) * this.ROWS : 0;
  }

  trackRow = (_: number, r: Distribucion) => r.orden_id;
}
