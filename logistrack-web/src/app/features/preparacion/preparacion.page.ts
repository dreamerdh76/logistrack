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
import { Orden, Page as P } from '../../shared/types/read-model';

@Component({
  standalone: true,
  selector: 'app-preparacion',
  imports: [
    CommonModule,
    FiltersBarComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    TableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './preparacion.page.html',
})
export class PreparacionPage {
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
        { value: 'COM', label: 'Completa' },
      ],
    },
    { type: 'date', name: 'desde', label: 'Desde (YYYY-MM-DD o ISO)' },
    { type: 'date', name: 'hasta', label: 'Hasta (YYYY-MM-DD o ISO)' },
  ];

  columns: TableColumn<Orden>[] = [
    { key: 'id', header: 'Orden' },
    { key: 'estado_preparacion', header: 'Estado' },
    { key: 'peso_total', header: 'Peso' },
    { key: 'volumen_total', header: 'Volumen' },
    {
      key: 'fecha_despacho',
      header: 'Fecha',
      cell: (r) => new Date(r.fecha_despacho).toLocaleString(),
    },
  ];

  vm$ = this.route.queryParamMap.pipe(
    map((q) => ({
      estado: q.get('estado') || '',
      desde: q.get('desde') || '',
      hasta: q.get('hasta') || '',
      page: Number(q.get('page') || 1),
      ordering: q.get('ordering') || '-fecha_despacho',
    })),
    switchMap((q) =>
      this.api
        .preparacion({
          estado: (q.estado as any) || undefined,
          desde: q.desde || undefined,
          hasta: q.hasta || undefined,
          page: q.page,
        })
        .pipe(
          map((p: P<Orden>) => ({
            q,
            data: p.results,
            count: p.count,
            loading: false,
            error: null,
          })),
          startWith({
            q,
            data: [] as Orden[],
            count: 0,
            loading: true,
            error: null,
          }),
          catchError((err) =>
            of({
              q,
              data: [] as Orden[],
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
    this.navigate({ estado: null, desde: null, hasta: null, page: 1 });
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

  trackRow = (_: number, r: Orden) => r.id;
}
