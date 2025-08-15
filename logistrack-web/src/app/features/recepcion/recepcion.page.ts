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
import { Recepcion, Page as P } from '../../shared/types/read-model';

@Component({
  standalone: true,
  selector: 'app-recepcion',
  imports: [
    CommonModule,
    FiltersBarComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    TableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recepcion.page.html',
})
export class RecepcionPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ReadApi);

  fields: FilterField[] = [
    { type: 'text', name: 'cd_id', label: 'CD' },
    { type: 'boolean', name: 'incidencias', label: 'Incidencias' },
    { type: 'date', name: 'desde', label: 'Desde (YYYY-MM-DD o ISO)' },
    { type: 'date', name: 'hasta', label: 'Hasta (YYYY-MM-DD o ISO)' },
  ];

  columns: TableColumn<Recepcion>[] = [
    { key: 'orden_id', header: 'Orden' },
    { key: 'cd_id', header: 'CD' },
    {
      key: 'fecha_recepcion',
      header: 'Fecha',
      cell: (r) => new Date(r.fecha_recepcion).toLocaleString(),
    },
    { key: 'usuario_receptor', header: 'Usuario' },
    { key: 'incidencias', header: 'Incidencias' },
  ];

  vm$ = this.route.queryParamMap.pipe(
    map((q) => ({
      cd_id: q.get('cd_id') || '',
      incidencias: q.get('incidencias') ?? '', // 'true'|'false'|''
      desde: q.get('desde') || '',
      hasta: q.get('hasta') || '',
      page: Number(q.get('page') || 1),
      ordering: q.get('ordering') || '-fecha_recepcion',
    })),
    switchMap((q) =>
      this.api
        .recepcion({
          cd_id: q.cd_id || undefined,
          incidencias:
            q.incidencias === '' ? undefined : q.incidencias === 'true',
          desde: q.desde || undefined,
          hasta: q.hasta || undefined,
          page: q.page,
        })
        .pipe(
          map((p: P<Recepcion>) => ({
            q,
            data: p.results,
            count: p.count,
            loading: false,
            error: null,
          })),
          startWith({
            q,
            data: [] as Recepcion[],
            count: 0,
            loading: true,
            error: null,
          }),
          catchError((err) =>
            of({
              q,
              data: [] as Recepcion[],
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
      cd_id: null,
      incidencias: null,
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

  trackRow = (_: number, r: Recepcion) => r.orden_id;
}
