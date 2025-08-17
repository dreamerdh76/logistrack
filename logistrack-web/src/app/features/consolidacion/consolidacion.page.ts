import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';

import { FiltersBarComponent, FilterField } from '../../shared/ui/filters-bar/filters-bar.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { TableComponent, TableColumn } from '../../shared/ui/table/table.component';
import { ReadApi } from '../read-api.service';
import { BloqueList, Page as P } from '../../shared/types/read-model';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { NoAutofocusDirective } from '../../shared/directives/no-autofocus.directive';

type Vm = {
  q: { fecha?: string; chofer_nombre?: string; estado?: 'COM' | 'INC' };
  page: number;
  data: BloqueList[];
  count: number;
  loading: boolean;
  error: any | null;
};

const toVm = (q: Vm['q'], page: number, patch: Partial<Vm> = {}): Vm => ({
  q, page, data: [], count: 0, loading: false, error: null, ...patch,
});

@Component({
  standalone: true,
  selector: 'app-consolidacion',
  imports: [
    CommonModule,
    FiltersBarComponent,
    TableComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ButtonModule,
    TooltipModule,
    NoAutofocusDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './consolidacion.page.html',
})
export class ConsolidacionPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ReadApi);
  private lastParamsJson = '';

  readonly ROWS = 5;

  // Filtros visibles
  fields: FilterField[] = [
    { type: 'date',  name: 'fecha',          label: 'Fecha (YYYY-MM-DD)' },
    { type: 'text',  name: 'chofer_nombre',  label: 'Chofer' },
    { type: 'select',name: 'estado',         label: 'Estado',
      options: [
        { value: 'COM', label: 'Completo' },
        { value: 'INC', label: 'Incompleto' },
      ],
    },
  ];

  // Columnas
  columns: TableColumn<BloqueList>[] = [
    { field: 'id', header: 'ID', headerClass: 'w-20', bodyClass: 'tabular-nums' },
    {
      field: 'fecha',
      header: 'Fecha',
      template: (r: BloqueList) => new Date(r.fecha as any).toLocaleString(),
      headerClass: 'min-w-[9rem]',
    },
    { field: 'chofer_nombre', header: 'Chofer', headerClass: 'min-w-[9rem]' },
    { field: 'total_ordenes', header: 'Órdenes', headerClass:'col-orders', bodyClass:'tabular-nums', colClass: 'col-orders' },
    {
      field: 'estado_completitud',
      header: 'Estado',
      template: (r: BloqueList) => r.estado_completitud,
      colClass:'col-status',
      headerClass:'col-status',
      bodyClass: (r) =>
        'col-status ' +
        (r.estado_completitud === 'INC'
          ? 'text-red-600 font-medium'
          : r.estado_completitud === 'COM'
          ? 'text-green-600 font-medium'
          : ''),
    },
  ];

  // Estado desde QueryParams
  vm$ = this.route.queryParamMap.pipe(
    map(qp => {
      const raw = Number(qp.get('page'));
      const page = Number.isFinite(raw) && raw > 0 ? raw : 1;

      const q: Vm['q'] = {};
      const fecha = qp.get('fecha');
      if (fecha && fecha.trim() !== '') q.fecha = fecha.trim();
      const chofer = qp.get('chofer_nombre');
      if (chofer && chofer.trim() !== '') q.chofer_nombre = chofer.trim();
      const estado = qp.get('estado');
      if (estado && estado.trim() !== '') q.estado = estado.trim() as Vm['q']['estado'];

      return { q, page };
    }),
    switchMap(({ q, page }) =>
      this.api.consolidacion({ ...q, page, page_size: this.ROWS }).pipe(
        map((p: P<BloqueList>) => toVm(q, page, { data: p.results, count: p.count })),
        startWith(toVm(q, page, { loading: true })),
        catchError(err => of(toVm(q, page, { error: err }))),
      )
    ),
  );

  // Filtros
  onFilters(v: Record<string, any>) {
    if (v && typeof v === 'object' && 'isTrusted' in v) return; // evita '?isTrusted=true'
    const params = this.cleanParams({ ...v, page: 1 });
    this.navigate(params);
  }
  onCleared() {
    this.navigate({ page: 1 }); // limpia totalmente los filtros en la URL
  }

  // Paginación (evento de <app-table>)
  onPage(e: { pageIndex: number; pageSize: number; length?: number }, q: Vm['q']) {
    const nextPage = (e?.pageIndex ?? 0) + 1;
    this.navigate({ ...q, page: nextPage });
  }

  // Navegación (sin merge + de-dupe)
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

  gotoDetail(id: string) {
    this.router.navigate(['/consolidacion', String(id)]);
  }

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
