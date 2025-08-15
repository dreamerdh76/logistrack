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

  readonly ROWS = 10;

  // ✅ solo cd + pyme_id
  fields: FilterField[] = [
    { type: 'text', name: 'cd',      label: 'CD (origen/destino)' },
    { type: 'text', name: 'pyme_id', label: 'PyME' },
  ];

  columns: TableColumn<Orden>[] = [
    { key: 'id',            header: 'Orden'   },
    { key: 'origen_cd_id',  header: 'Origen'  },
    { key: 'destino_cd_id', header: 'Destino' },
    {
      key: 'fecha_despacho',
      header: 'Fecha',
      cell: (r) => new Date(r.fecha_despacho).toLocaleString(),
    },
  ];

  // ✅ query params sin fechas
  vm$ = this.route.queryParamMap.pipe(
    map((q) => ({
      cd: q.get('cd') || '',
      pyme_id: q.get('pyme_id') || '',
      page: Number(q.get('page') || 1),
      ordering: q.get('ordering') || '-fecha_despacho',
    })),
    switchMap((q) =>
      this.api.despacho({
        cd: q.cd || undefined,
        pyme_id: q.pyme_id || undefined,
        page: q.page,
        // si tu API soporta ordering, pásalo aquí
        // ordering: q.ordering,
      }).pipe(
        map((p: P<Orden>) => ({ q, data: p.results, count: p.count, loading: false, error: null })),
        startWith({ q, data: [] as Orden[], count: 0, loading: true, error: null }),
        catchError((err) => of({ q, data: [] as Orden[], count: 0, loading: false, error: err })),
      ),
    ),
  );

  onFilters(v: Record<string, any>) {
    // ✅ removemos posibles residuos de 'desde'/'hasta' del URL
    this.navigate({ ...v, page: 1, desde: null, hasta: null });
  }

  onCleared() {
    // ✅ limpiar todo excepto paginación
    this.navigate({ cd: null, pyme_id: null, page: 1, desde: null, hasta: null });
  }

  onPage(e: { pageIndex: number; pageSize: number; length: number }, q: any) {
    this.navigate({ ...q, page: e.pageIndex + 1, desde: null, hasta: null });
  }

  private navigate(params: any) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...params, desde: null, hasta: null },
      queryParamsHandling: 'merge',
    });
  }

  firstOf(page?: number) { const p = Number(page) || 1; return Math.max(0, (p - 1) * this.ROWS); }
}
