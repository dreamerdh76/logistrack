import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  TemplateRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { PaginatorModule } from 'primeng/paginator';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ViewEncapsulation } from '@angular/core';
/* ============================
 * Tipos de columnas
 * ============================ */

type ClassVal = string | string[] | { [k: string]: boolean };
type RowClassVal<T> = ClassVal | ((row: T) => ClassVal);

type BaseCol<T> = {
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  /** contenido programático */
  template?: (row: T) => any;
  cell?: (row: T) => any;

  /** clases para <th> */
  headerClass?: ClassVal;

  /** clases para <td> (oficial) */
  bodyClass?: RowClassVal<T>;

  colClass?: ClassVal;
};

export type TableColumn<T = any> =
  | ({ field: keyof T | string; key?: never } & BaseCol<T>)
  | ({ key:   keyof T | string; field?: never } & BaseCol<T>);

/* ============================
 * Componente
 * ============================ */

@Component({
  selector: 'app-table',
  standalone: true,
  imports: [CommonModule, TableModule, PaginatorModule, ProgressSpinnerModule],
  templateUrl: './table.component.html',
  styleUrls: ['./table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'pro-table block app-table' },
  encapsulation: ViewEncapsulation.None,
})
export class TableComponent<T = any> implements OnChanges {
  /* Data & columnas */
  @Input() columns: TableColumn<T>[] = [];
  @Input() value: T[] = [];

  /* Paginación / orden */
  @Input() totalRecords = 0;
  @Input() rows = 20;
  @Input() first = 0;
  @Input() sortField: string | null = null;
  @Input() sortOrder: 1 | -1 | 0 = 0;

  /* Estado */
  @Input() loading = false;

  /* Acciones */
  @Input() showActions = false;
  @ContentChild('actionTemplate') actionTemplate?: TemplateRef<any>;
  /** Puedes usarla desde fuera si necesitas aplicar clases a la col de acciones */
  @Input() actionColClass = 'text-right w-24 max-[1024px]:w-16';

  /* Outputs */
  @Output() page = new EventEmitter<{ pageIndex: number; pageSize: number; length: number }>();
  @Output() rowClick = new EventEmitter<T>();

  /* Aliases opcionales para integraciones */
  @Input() set data(v: T[] | null | undefined) { this.value = v ?? []; }
  @Input() set length(v: number | null | undefined) { this.totalRecords = v ?? 0; }
  @Input() set pageIndex(v: number | null | undefined) { this.first = (v ?? 0) * this.rows; }

  /* ============================
   * Ciclo de vida
   * ============================ */
  ngOnChanges(ch: SimpleChanges) {
    if (ch['totalRecords'] || ch['rows'] || ch['first']) {
      const total = Math.max(0, this.totalRecords);
      const rows  = Math.max(1, this.rows || 1);
      const last  = total > 0 ? Math.floor((total - 1) / rows) : 0;
      const maxFirst = last * rows;

      if (!Number.isFinite(this.first) || this.first < 0) this.first = 0;
      if (this.first > maxFirst) this.first = maxFirst;
    }
  }

  /* ============================
   * Eventos PrimeNG
   * ============================ */
  onPrimePage(e: { first: number; rows: number; page?: number }) {
    const pageIndex = (typeof e.page === 'number')
      ? e.page
      : (e.rows ? Math.floor(e.first / e.rows) : 0);

    this.page.emit({ pageIndex, pageSize: e.rows, length: this.totalRecords });
  }

  /* ============================
   * Helpers de columna/celda
   * ============================ */

  /** Devuelve el nombre del campo de la columna como string */
  getField(c: TableColumn<T>): string {
    // Usa 'field' si existe; de lo contrario 'key'
    const raw: any = (('field' in c && c.field !== undefined) ? c.field : (c as any).key);
    return String(raw);
  }

  /** Valor a mostrar en la celda */
  cellValue(row: T, c: TableColumn<T>) {
    if (c.template) return c.template(row);
    if (c.cell) return c.cell(row);
    const f = this.getField(c);
    return (row as any)?.[f];
  }

  /** Normaliza cualquier valor de clases a un string seguro para [ngClass] */
  private normalizeClass(input: any): string {
    if (!input) return '';
    if (typeof input === 'string') return input;
    if (Array.isArray(input)) return input.filter(Boolean).join(' ');
    if (typeof input === 'object') {
      return Object.entries(input)
        .filter(([, v]) => !!v)
        .map(([k]) => k)
        .join(' ');
    }
    return '';
  }

  /** Clases para <th> */
  headerClass(col: TableColumn<T>): string {
    return this.normalizeClass((col as any).headerClass);
  }

  /** Clases para <td> (lee bodyClass o el alias cellClass) + reglas por campo si quieres */
  colClass(row: T, col: TableColumn<T>): string {
    // bodyClass puede ser función(row) o valor directo
    const rawBody =
      typeof (col as any).bodyClass === 'function'
        ? (col as any).bodyClass(row)
        : (col as any).bodyClass;

    // alias: cellClass (por compatibilidad con tu page)
    const rawAlias =
      typeof (col as any).cellClass === 'function'
        ? (col as any).cellClass(row)
        : (col as any).cellClass;

    let cls = this.normalizeClass(rawBody ?? rawAlias);

    // Reglas adicionales por campo (opcional)
    const f = this.getField(col);
    if (f === 'estado' && (row as any)?.estado === 'INC') {
      cls += ' text-red-600 font-medium';
    }
    if (f === 'id') {
      cls += ' tabular-nums';
    }

    return cls.trim();
  }
}
