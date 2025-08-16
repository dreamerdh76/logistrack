import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { PageEvent } from '@angular/material/paginator';

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
  readonly ROWS = 5;

  columns: TableColumn<Orden>[] = [
    { key: 'id', header: 'Orden',  cell: r => r.id },
    { key: 'chofer', header: 'Chofer', cell: r => r.chofer?.nombre ?? '—' },
    {key: 'bolsas_count', header: 'Bolsas'},
    { key: 'fecha_despacho', header: 'Fecha', cell: r => new Date(r.fecha_despacho).toLocaleString() },
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

  trackRow = (_: number, r: Orden) => r.id;
}
