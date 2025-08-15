import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './empty-state.component.html',
  // sin styles/scss: todo con Tailwind
  host: { class: 'block' },
})
export class EmptyStateComponent {
  @Input() title: string = 'Sin datos';
  @Input() subtitle: string = 'Ajusta los filtros y vuelve a intentar.';
  @Input() actionLabel?: string;
  @Output() action = new EventEmitter<void>();
}
