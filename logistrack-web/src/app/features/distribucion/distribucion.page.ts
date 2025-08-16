import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { PageEvent } from '@angular/material/paginator';

import {
  FiltersBarComponent,
  FilterField,
} from '../../shared/ui/filters-bar/filters-bar.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import {
  TableComponent,
  TableColumn,
} from '../../shared/ui/table/table.component';

import { ReadApi } from '../read-api.service';
import { Distribucion, Page as P } from '../../shared/types/read-model';

@Component({
  standalone: true,
  selector: 'app-distribucion',
  imports: [
    CommonModule,
    FiltersBarComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    TableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './distribucion.page.html',
})
export class DistribucionPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ReadApi);
  readonly ROWS = 5;

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

  columns: TableColumn<Distribucion>[] = [
    {
      key: 'fecha_entrega',
      header: 'Fecha entrega',
      cell: (r) =>
        r.fecha_entrega ? new Date(r.fecha_entrega).toLocaleString() : '—',
    },
    { key: 'chofer_id', header: 'Chofer' },
    { key: 'estado',
      header: 'Estado' ,
      cell: r => r.estado_label ?? r.estado,
    // color por estado
      bodyClass: (r) =>
        r.estado === 'ENT' ? 'text-green-600 font-medium' :
        r.estado === 'REJ' ? 'text-red-600 font-medium'  :
        /* PEN */           'text-amber-600 font-medium',
    },

  ];

  vm$ = this.route.queryParamMap.pipe(
    map((q) => ({
      estado: q.get('estado') || '',
      page: Number(q.get('page') || 1),
      ordering: q.get('ordering') || '-fecha_entrega',
    })),
    switchMap((q) =>
      this.api
        .distribucion({
          estado: (q.estado as any) || undefined,
          page: q.page,
        })
        .pipe(
          map((p: P<Distribucion>) => ({
            q,
            data: p.results,
            count: p.count,
            loading: false,
            error: null,
          })),
          startWith({
            q,
            data: [] as Distribucion[],
            count: 0,
            loading: true,
            error: null,
          }),
          catchError((err) =>
            of({
              q,
              data: [] as Distribucion[],
              count: 0,
              loading: false,
              error: err,
            }),
          ),
        ),
    ),
  );

  onFilters(v: Record<string, any>) {
    const params: any = { page: 1 }; // resetea a la primera página
    for (const f of this.fields) {
      const val = Object.prototype.hasOwnProperty.call(v, f.name) ? v[f.name] : null;
      params[f.name] = (val === '' || val == null) ? null : val;
    }
    this.navigate(params);
  }

  // Limpiar filtros (ojo: chofer_nombre, no chofer_id)
  onCleared() {
    this.navigate({ fecha: null, chofer_nombre: null, estado: null, page: 1 });
  }
  onPage(e: PageEvent, q: any) {
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
  trackRow = (_: number, r: Distribucion) => r.orden_id;
}
