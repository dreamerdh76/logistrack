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
    { type: 'text', name: 'cd', label: 'CD' },
    { type: 'boolean', name: 'incidencias', label: 'Incidencias' }
  ];

  columns: TableColumn<Recepcion>[] = [
    { key: 'orden_id', header: 'Orden' },
    { key: 'cd', header: 'Centro Distribucion', cell: r => r.cd?.nombre ?? '—' },
    { key: 'usuario_receptor', header: 'Usuario' },
    { key: 'incidencias', header: 'Incidencias' },
  ];

  vm$ = this.route.queryParamMap.pipe(

    map((q) => {
      const rawInc = q.get('incidencias');        // 'true' | 'false' | null
      return {
        cd: q.get('cd') || '',              // usa cd_id de punta a punta
        incidencias: rawInc === null ? null : rawInc === 'true',
        page: Number(q.get('page') || 1),
        ordering: q.get('ordering') || '-fecha_recepcion',
      };
    }),
    switchMap((q) =>
      this.api
        .recepcion({
          cd: q.cd || undefined,
          incidencias: q.incidencias ?? undefined,
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
      const params: any = { page: 1 }; // resetea a la primera página
      for (const f of this.fields) {
        const val = Object.prototype.hasOwnProperty.call(v, f.name) ? v[f.name] : null;
        params[f.name] = (val === '' || val == null) ? null : val;
      }
      this.navigate(params);
    }
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

  trackRow = (_: number, r: Recepcion) => r.orden_id;
}
