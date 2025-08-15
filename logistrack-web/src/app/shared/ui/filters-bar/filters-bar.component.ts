import {
  ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule, ReactiveFormsModule, InputTextModule, SelectModule, DatePickerModule
            , ButtonModule, FloatLabelModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './filters-bar.component.html',
  styleUrls: ['./filters-bar.component.css'],
})
export class FiltersBarComponent implements OnChanges, OnDestroy {
  @Input() fields: FilterField[] = [];
  @Input() value: Record<string, any> = {};
  @Input() autoApply = true;                 // ✅ para que [autoApply] no rompa
  @Input() debounce = 300;

  @Input() inline = true;
  @Input() itemWidth = 260;

  @Output() change = new EventEmitter<Record<string, any>>();
  @Output() cleared = new EventEmitter<void>();

  form: FormGroup;
  private sub?: Subscription;

  constructor(private fb: FormBuilder) { this.form = this.fb.group({}); }

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['fields']) {
      const cfg: Record<string, any> = {};
      for (const f of this.fields) {
        const raw = this.value?.[f.name];
        cfg[f.name] = [f.type === 'date' ? this.toDateOrNull(raw) : (raw ?? '')];
      }
      this.form = this.fb.group(cfg);

      this.sub?.unsubscribe();
      if (this.autoApply) {
        this.sub = this.form.valueChanges.pipe(
          debounceTime(this.debounce),
          map(v => this.clean(v)),
          distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
        ).subscribe(v => this.change.emit(v));
      }
    }

    if (ch['value'] && this.form) {
      const patch: any = {};
      for (const f of this.fields) {
        const raw = this.value?.[f.name];
        patch[f.name] = f.type === 'date' ? this.toDateOrNull(raw) : (raw ?? '');
      }
      this.form.patchValue(patch, { emitEvent: false });
    }
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  // ---- header helpers (evitan usar Object.* y arrows en template)
  get activeCount(): number {
    const v = this.form?.value ?? {};
    let n = 0;
    for (const k of Object.keys(v)) if (v[k] !== '' && v[k] !== null && v[k] !== undefined) n++;
    return n;
  }
  get hasAny(): boolean { return this.activeCount > 0; }

  apply() { this.change.emit(this.clean(this.form.getRawValue())); }
  clear() {
    for (const f of this.fields) {
      const empty = f.type === 'date' ? null : '';
      this.form.get(f.name)?.setValue(empty, { emitEvent: false });
    }
    this.cleared.emit();
    this.apply();
  }

  trackField = (_: number, f: FilterField) => f.name;

  private clean(raw: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v === '' || v === null || v === undefined) continue;
      if (v instanceof Date && !isNaN(v.getTime())) { out[k] = this.toYYYYMMDD(v); continue; }
      if (typeof v === 'string') {
        const t = v.trim(); if (t === '') continue;
        if (t === 'true')  { out[k] = true;  continue; }
        if (t === 'false') { out[k] = false; continue; }
        out[k] = t; continue;
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
        const [, ys = '', ms = '', ds = ''] = m; // <- valores por defecto
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
