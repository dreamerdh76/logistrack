import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';

import { FiltersBarComponent, FilterField } from '../../shared/ui/filters-bar/filters-bar.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { TableComponent, TableColumn } from '../../shared/ui/table/table.component';
import { ReadApi } from '../read-api.service';
import { BloqueList, Page as P } from '../../shared/types/read-model';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { NoAutofocusDirective } from '../../shared/directives/no-autofocus.directive';

@Component({
  standalone: true,
  selector: 'app-consolidacion',
  imports: [
    CommonModule,
    FiltersBarComponent,
    TableComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ButtonModule,
    TooltipModule,
    NoAutofocusDirective
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './consolidacion.page.html',
})
export class ConsolidacionPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ReadApi);

  readonly ROWS = 5;

  // Filtros (el FiltersBar aplicará [appendTo]="'self'" y panelStyleClass 'overlay-mobile' internamente)
  fields: FilterField[] = [
    { type: 'date',  name: 'fecha',          label: 'Fecha (YYYY-MM-DD)' },
    { type: 'text',  name: 'chofer_nombre',  label: 'Chofer' },
    { type: 'select',name: 'estado',         label: 'Estado',
      options: [
        { value: 'COM', label: 'Completo' },
        { value: 'INC', label: 'Incompleto' }
      ]
    },
  ];

  // Columnas (el TableComponent ya inserta <span class="p-column-title"> en móvil)
  columns: TableColumn<BloqueList>[] = [
    {
      field: 'id',
      header: 'ID',
      headerClass: 'w-20',
      bodyClass: 'tabular-nums'
    },
    {
      field: 'fecha',
      header: 'Fecha',
      // Render legible; evita usar pipes si tu modelo trae ISO/number
      template: (r: BloqueList) => new Date(r.fecha as any).toLocaleString(),
      headerClass: 'min-w-[9rem]'
    },
    {
      field: 'chofer_nombre',
      header: 'Chofer',
      headerClass: 'min-w-[9rem]'
    },
    {
      field: 'total_ordenes',
      header: 'Órdenes',
      headerClass:'col-orders',
      bodyClass:'tabular-nums',
      colClass: 'col-orders'
    },
    {
      field: 'estado_completitud',
      header: 'Estado',
      template: (r: BloqueList) => r.estado_completitud,
      colClass:'col-status',
      headerClass:'col-status',
      // Colorea según estado
      bodyClass:(r)=> 'col-status ' + (r.estado_completitud==='INC' ? 'text-red-600 font-medium'
                                  : r.estado_completitud==='COM' ? 'text-green-600 font-medium' : '')
    },
  ];

  vm$ = this.route.queryParamMap.pipe(
    map(q => {
      const raw = Number(q.get('page'));
      const page = Number.isFinite(raw) && raw > 0 ? raw : 1;
      return {
        fecha: q.get('fecha') || '',
        chofer_nombre: q.get('chofer_nombre') || '',
        estado: q.get('estado') || '',
        page,
      };
    }),
    switchMap(q =>
      this.api.consolidacion({
        fecha: q.fecha || undefined,
        chofer_nombre: q.chofer_nombre || undefined,
        estado: (q.estado as any) || undefined,
        page: q.page,
      }).pipe(
        map((p: P<BloqueList>) => ({ q, data: p.results, count: p.count, loading: false, error: null })),
        startWith({ q, data: [] as BloqueList[], count: 0, loading: true, error: null }),
        catchError(err => of({ q, data: [], count: 0, loading: false, error: err })),
      )
    )
  );

  // Navegación (merge de query params)
  private navigate(params: any) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge'
    });
  }

  // Al aplicar filtros desde la barra
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

  // PageEvent-like del TableComponent
  onPage(e: { pageIndex: number; pageSize: number }, q: any) {
    this.navigate({ ...q, page: e.pageIndex + 1 });
  }

  // Util para paginador Prime table
  firstOf(page?: number) {
    const p = Number(page) || 1;
    return Math.max(0, (p - 1) * this.ROWS);
  }

  // Detalle
  gotoDetail(id: string) {
    this.router.navigate(['/consolidacion', String(id)]);
  }
}
