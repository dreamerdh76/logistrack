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
  selector: 'app-expedicion',
  imports: [
    CommonModule,
    FiltersBarComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    TableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './expedicion.page.html',
})
export class ExpedicionPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ReadApi);

  fields: FilterField[] = [
    { type: 'text', name: 'chofer_id', label: 'Chofer' },
    { type: 'date', name: 'fecha', label: 'Fecha (YYYY-MM-DD)' },
  ];

  columns: TableColumn<Orden>[] = [
    { key: 'id', header: 'Orden' },
    { key: 'chofer_id', header: 'Chofer' },
    {
      key: 'fecha_despacho',
      header: 'Fecha',
      cell: (r) => new Date(r.fecha_despacho).toLocaleString(),
    },
    { key: 'peso_total', header: 'Peso' },
    { key: 'volumen_total', header: 'Volumen' },
  ];

  vm$ = this.route.queryParamMap.pipe(
    map((q) => ({
      chofer_id: q.get('chofer_id') || '',
      fecha: q.get('fecha') || '',
      page: Number(q.get('page') || 1),
      ordering: q.get('ordering') || '-fecha_despacho',
    })),
    switchMap((q) =>
      this.api
        .expedicion({
          chofer_id: q.chofer_id || undefined,
          fecha: q.fecha || undefined,
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
    this.navigate({ chofer_id: null, fecha: null, page: 1 });
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
