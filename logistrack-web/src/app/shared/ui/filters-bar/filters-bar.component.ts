import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser, DOCUMENT } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ButtonModule } from 'primeng/button';
import { Subscription, debounceTime, map, distinctUntilChanged } from 'rxjs';
import { FloatLabelModule } from 'primeng/floatlabel';

export type FilterField =
  | { type: 'text'; name: string; label: string; placeholder?: string }
  | { type: 'select'; name: string; label: string; options: { value: string; label: string }[]; placeholder?: string }
  | { type: 'date'; name: string; label: string; placeholder?: string }
  | { type: 'boolean'; name: string; label: string };

@Component({
  selector: 'app-filters-bar',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputTextModule,
    SelectModule,
    DatePickerModule,
    ButtonModule,
    FloatLabelModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './filters-bar.component.html',
  styleUrls: ['./filters-bar.component.css'],
})
export class FiltersBarComponent implements OnChanges, OnDestroy {
  @Input() fields: FilterField[] = [];
  @Input() value: Record<string, any> = {};
  @Input() autoApply = true;
  @Input() debounce = 300;

  @Input() inline = true;
  @Input() itemWidth = 260;

  @Output() filtersChange = new EventEmitter<Record<string, any>>();
  @Output() cleared = new EventEmitter<void>();

  form: FormGroup;
  private sub?: Subscription;
  private readonly isBrowser: boolean;

  constructor(
    private fb: FormBuilder,
    @Inject(PLATFORM_ID) platformId: Object,
    @Inject(DOCUMENT) private doc: Document
  ) {
    this.form = this.fb.group({});
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnChanges(ch: SimpleChanges): void {
    // (1) Re-construye el form cuando cambian fields o autoApply (updateOn dinámico)
    if (ch['fields'] || ch['autoApply']) {
      const group: Record<string, any> = {};
      for (const f of this.fields) {
        const raw = this.value?.[f.name];
        const init = f.type === 'date' ? this.toDateOrNull(raw) : (raw ?? null);
        const updateOn: 'change' | 'blur' =
          f.type === 'text' ? (this.autoApply ? 'change' : 'blur') : 'change';
        group[f.name] = this.fb.control(init, { updateOn });
      }
      this.form = this.fb.group(group);

      this.sub?.unsubscribe();
      if (this.autoApply) {
        this.sub = this.form.valueChanges
          .pipe(
            debounceTime(this.debounce),
            map((v) => this.clean(v)),
            distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
          )
          .subscribe(v => {
          this.filtersChange.emit(v);
        });
      }
    }

    // (2) Patch seguro: ignora keys ausentes, no pises dirty ni el campo con foco (SSR-safe)
      if (ch['value'] && this.form) {
        // Normaliza el form tal como se emite (clean convierte date→'YYYY-MM-DD', trim, etc.)
        const currentClean = this.clean(this.form.getRawValue());
        const incoming     = this.value ?? {};
        if (JSON.stringify(incoming) === JSON.stringify(currentClean)) {
          return; // ya estamos alineados; no parchar, evita "rebotes" al perder foco
        }

        const safePatch: Record<string, any> = {};
        const focusedName = this.isBrowser
          ? (this.doc.activeElement as HTMLElement | null)?.getAttribute?.('formcontrolname')
          : null;

        for (const f of this.fields) {
          if (!Object.prototype.hasOwnProperty.call(this.value ?? {}, f.name)) continue;

          const ctrl = this.form.get(f.name);
          const next = f.type === 'date'
            ? this.toDateOrNull(this.value?.[f.name])
            : (this.value?.[f.name] ?? null);
          const curr = ctrl?.value;

          const equal = (curr instanceof Date && next instanceof Date)
            ? curr.getTime() === next.getTime()
            : curr === next;

          const isFocused = focusedName === f.name;
          if (!ctrl?.dirty && !isFocused && !equal) safePatch[f.name] = next;
        }

        if (Object.keys(safePatch).length) {
          this.form.patchValue(safePatch, { emitEvent: false });
        }
      }
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  // ---- header helpers
  get activeCount(): number {
    const v = this.form?.value ?? {};
    let n = 0;
    for (const k of Object.keys(v))
      if (v[k] !== '' && v[k] !== null && v[k] !== undefined) n++;
    return n;
  }
  get hasAny(): boolean {
    return this.activeCount > 0;
  }

  apply() {
    this.filtersChange.emit(this.clean(this.form.getRawValue()));
  }

  clear() {
    for (const f of this.fields) {
      this.form.get(f.name)?.setValue(null, { emitEvent: false }); // vacío consistente
    }
    this.cleared.emit();
    this.apply();
  }

  trackField = (_: number, f: FilterField) => f.name;

  private clean(raw: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v === '' || v === null || v === undefined) continue;
      if (v instanceof Date && !isNaN(v.getTime())) {
        out[k] = this.toYYYYMMDD(v);
        continue;
      }
      if (typeof v === 'string') {
        const t = v.trim();
        if (t === '') continue;
        if (t === 'true') {
          out[k] = true;
          continue;
        }
        if (t === 'false') {
          out[k] = false;
          continue;
        }
        out[k] = t;
        continue;
      }
      out[k] = v;
    }
    return out;
  }

  private toDateOrNull(v: any): Date | null {
    if (!v) return null;
    if (v instanceof Date && !isNaN(v.getTime())) return v;

    if (typeof v === 'string') {
      // 'YYYY-MM-DD' -> Date local sin desfase
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
      if (m) {
        const [, ys = '', ms = '', ds = ''] = m;
        const y = Number(ys);
        const mo = Number(ms) - 1;
        const d = Number(ds);
        if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
        const dt = new Date(y, mo, d);
        return isNaN(dt.getTime()) ? null : dt;
      }
      const dt = new Date(v);
      return isNaN(dt.getTime()) ? null : dt;
    }
    return null;
  }

  private toYYYYMMDD(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
