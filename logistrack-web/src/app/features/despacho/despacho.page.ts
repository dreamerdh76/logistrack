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
    map((q) => {
      const raw = Number(q.get('page'));
      const page = Number.isFinite(raw) && raw > 0 ? raw : 1;
      return {
        cd: q.get('cd') || '',
        pyme: q.get('pyme') || '',
        page,
      };
    }),
    switchMap((q) =>
      this.api.despacho({
        cd: q.cd || undefined,
        pyme: q.pyme || undefined,
        page: q.page,
      }).pipe(
        map((p: P<Orden>) => ({ q, data: p.results, count: p.count, loading: false, error: null })),
        startWith({ q, data: [] as Orden[], count: 0, loading: true, error: null }),
        catchError((err) => of({ q, data: [] as Orden[], count: 0, loading: false, error: err })),
      ),
    ),
  );

  // ---- Handlers de filtros/paginación (mismo patrón que Consolidación) ----
  onFilters(v: Record<string, any>) {
    const params: any = { page: 1 };
    for (const f of this.fields) {
      const val = Object.prototype.hasOwnProperty.call(v, f.name) ? v[f.name] : null;
      params[f.name] = (val === '' || val == null) ? null : val;
    }
    this.navigate(params);
  }

  onCleared() {
    this.navigate({ cd: null, pyme_id: null, page: 1 });
  }

  onPage(e: { pageIndex: number; pageSize: number }, q: any) {
    this.navigate({ ...q, page: e.pageIndex + 1 });
  }

  private navigate(params: any) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
    });
  }

  firstOf(page?: number) {
    const p = Number(page) || 1;
    return Math.max(0, (p - 1) * this.ROWS);
  }
}
