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
  readonly ROWS = 5;

  fields: FilterField[] = [
    {
      type: 'select',
      name: 'estado',
      label: 'Estado',
      options: [
        { value: 'PEN', label: 'Pendiente' },
        { value: 'COM', label: 'Completa' },
      ],

    }
  ];

  columns: TableColumn<Orden>[] = [
    { key: 'id', header: 'Orden' },
    { key: 'estado_preparacion',
      header: 'Estado',
      template: (r: Orden) => r.estado_preparacion === 'COM' ? 'Completa' : 'Pendiente',
      bodyClass: (r: Orden) =>(
          r.estado_preparacion === 'COM'
            ? 'text-green-600 font-medium'
            : 'text-red-600 font-medium'
        ),

     },
    { key: 'peso_total', header: 'Peso' },
    { key: 'volumen_total', header: 'Volumen' },
  ];

  vm$ = this.route.queryParamMap.pipe(
    map((q) => ({
      estado: q.get('estado') || '',
      page: Number(q.get('page') || 1),
      ordering: q.get('ordering') || '-fecha_despacho',
    })),
    switchMap((q) =>
      this.api
        .preparacion({
          estado: (q.estado as any) || undefined,
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
    const params: any = { page: 1 };
    for (const f of this.fields) {
      const has = Object.prototype.hasOwnProperty.call(v, f.name);
      const val = has ? v[f.name] : null;
      params[f.name] = (val === '' || val == null) ? null : val;
    }
    this.navigate(params);
  }
  onCleared() {
    const params: any = { page: 1 };
    for (const f of this.fields) params[f.name] = null;
    this.navigate(params);
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
  trackRow = (_: number, r: Orden) => r.id;
}
