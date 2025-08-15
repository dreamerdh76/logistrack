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
  selector: 'app-error-state',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './error-state.component.html',
  host: { class: 'block' },
})
export class ErrorStateComponent {
  @Input() message: string = 'Intenta nuevamente.';
  @Input() retryLabel: string = 'Reintentar';
  @Output() retry = new EventEmitter<void>();
}
