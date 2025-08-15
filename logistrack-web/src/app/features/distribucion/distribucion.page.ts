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
    { type: 'text', name: 'chofer_id', label: 'Chofer' },
    { type: 'date', name: 'desde', label: 'Desde (YYYY-MM-DD o ISO)' },
    { type: 'date', name: 'hasta', label: 'Hasta (YYYY-MM-DD o ISO)' },
  ];

  columns: TableColumn<Distribucion>[] = [
    { key: 'orden_id', header: 'Orden' },
    { key: 'estado', header: 'Estado' },
    {
      key: 'fecha_entrega',
      header: 'Fecha entrega',
      cell: (r) =>
        r.fecha_entrega ? new Date(r.fecha_entrega).toLocaleString() : '—',
    },
    { key: 'chofer_id', header: 'Chofer' },
  ];

  vm$ = this.route.queryParamMap.pipe(
    map((q) => ({
      estado: q.get('estado') || '',
      chofer_id: q.get('chofer_id') || '',
      desde: q.get('desde') || '',
      hasta: q.get('hasta') || '',
      page: Number(q.get('page') || 1),
      ordering: q.get('ordering') || '-fecha_entrega',
    })),
    switchMap((q) =>
      this.api
        .distribucion({
          estado: (q.estado as any) || undefined,
          chofer_id: q.chofer_id || undefined,
          desde: q.desde || undefined,
          hasta: q.hasta || undefined,
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
    this.navigate({ ...v, page: 1 });
  }
  onCleared() {
    this.navigate({
      estado: null,
      chofer_id: null,
      desde: null,
      hasta: null,
      page: 1,
    });
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

  trackRow = (_: number, r: Distribucion) => r.orden_id;
}
