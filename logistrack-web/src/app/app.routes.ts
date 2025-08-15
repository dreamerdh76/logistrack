import { Routes } from '@angular/router';
import { ShellComponent } from './core/layout/shell.component';

export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'consolidacion' },
      {
        path: 'despacho',
        loadComponent: () =>
          import('./features/despacho/despacho.page').then(
            (m) => m.DespachoPage,
          ),
      },
      {
        path: 'preparacion',
        loadComponent: () =>
          import('./features/preparacion/preparacion.page').then(
            (m) => m.PreparacionPage,
          ),
      },
      {
        path: 'expedicion',
        loadComponent: () =>
          import('./features/expedicion/expedicion.page').then(
            (m) => m.ExpedicionPage,
          ),
      },
      {
        path: 'recepcion',
        loadComponent: () =>
          import('./features/recepcion/recepcion.page').then(
            (m) => m.RecepcionPage,
          ),
      },
      {
        path: 'consolidacion',
        loadComponent: () =>
          import('./features/consolidacion/consolidacion.page').then(
            (m) => m.ConsolidacionPage,
          ),
      },
      {
        path: 'consolidacion/:id',
        loadComponent: () =>
          import('./features/consolidacion/bloque-detalle.page').then(
            (m) => m.BloqueDetallePage,
          ),
      },
      {
        path: 'distribucion',
        loadComponent: () =>
          import('./features/distribucion/distribucion.page').then(
            (m) => m.DistribucionPage,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
