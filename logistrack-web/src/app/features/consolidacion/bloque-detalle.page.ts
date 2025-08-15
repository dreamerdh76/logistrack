import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, combineLatest, startWith, switchMap, map, catchError, of, distinctUntilChanged } from 'rxjs';

import { ReadApi } from '../read-api.service';
import { BloqueDetail, Orden } from '../../shared/types/read-model';

// PrimeNG
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

// Estados
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';

type VM = { b: BloqueDetail | null; loading: boolean; error: any };

@Component({
  standalone: true,
  selector: 'app-bloque-detalle',
  imports: [
    CommonModule,
    RouterLink,
    TableModule,
    ButtonModule,
    TagModule,
    ErrorStateComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bloque-detalle.page.html',
})
export class BloqueDetallePage {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ReadApi);

  // Dispara recargas manuales (botón reintentar)
  private readonly refresh$ = new Subject<void>();

  // ViewModel tipado + loading
  vm$ = combineLatest([
    this.route.paramMap.pipe(
      map((p) => p.get('id')!),
      distinctUntilChanged()
    ),
    this.refresh$.pipe(startWith(void 0))
  ]).pipe(
    switchMap(([id]) =>
      this.api.bloqueDetalle(id).pipe(
        map((b) => ({ b, error: null, loading: false }) as VM),
        startWith({ b: null, error: null, loading: true } as VM),
        catchError((err) => of({ b: null, error: err, loading: false } as VM))
      )
    )
  );

  onRetry() { this.refresh$.next(); }

  // PrimeNG trackBy (mejor rendimiento)
  trackOrden = (_: number, o: Orden) => o.id;

  // --- Estado → clases Tailwind (sin crear objetos en cada CD)
  private normalizeStatus(v?: string): 'COM' | 'INC' | 'PEN' | 'UNK' {
    const k = (v ?? '').trim().toUpperCase();
    if (k.startsWith('COMPLET')) return 'COM';
    if (k.startsWith('INCOMPLET')) return 'INC';
    if (k.startsWith('PEND')) return 'PEN';
    if (k === 'COM') return 'COM';
    if (k === 'INC') return 'INC';
    if (k === 'PEN') return 'PEN';
    return 'UNK';
  }

  statusClass(v?: string): string {
    switch (this.normalizeStatus(v)) {
      case 'COM': return 'bg-green-600 text-white';
      case 'INC': return 'bg-red-600 text-white';
      case 'PEN': return 'bg-amber-500 text-black';
      default:    return 'bg-gray-300 text-gray-900';
    }
  }
  rowTrackBy = (_index: number, r: Orden) => r.id
}
