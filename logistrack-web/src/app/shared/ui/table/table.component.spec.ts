// src/app/shared/ui/table/table.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { TableComponent, TableColumn } from './table.component';

type Row = { id: string; estado?: 'OK' | 'INC'; extra?: string };

describe('TableComponent (standalone, zoneless)', () => {
  let component: TableComponent<Row>;

  const rows: Row[] = [
    { id: '1', estado: 'INC', extra: 'a' },
    { id: '2', estado: 'OK',  extra: 'b' },
  ];

  const columns: TableColumn<Row>[] = [
    {
      key: 'id',
      header: 'ID',
      // ✅ usar un solo tipo: objeto (nada de mezclar string[] + object)
      headerClass: { 'text-right': true, hidden: false },
    },
    {
      key: 'estado',
      header: 'Estado',
      // verde si OK (el rojo por INC lo añade la regla extra del componente)
      bodyClass: (r: Row) => (r.estado === 'OK' ? 'text-green-600' : ''),
    },
    {
      key: 'extra',
      header: 'Extra',
      cell: (r: Row) => `x-${r.extra}`,
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TableComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    component = TestBed.createComponent(TableComponent<Row>).componentInstance;
    component.columns = columns;
    component.value = rows.slice();
    component.totalRecords = rows.length;
    component.rows = 5;
    component.first = 0;
  });

  it('debe crearse', () => {
    expect(component).toBeTruthy();
  });

  it('getField y cellValue funcionan (cell tiene prioridad)', () => {
    // getField usa key/field indistintamente
    expect((component as any)['getField'](columns[0]!)).toBe('id');

    // cellValue usa cell cuando existe
    expect(component.cellValue(rows[0]!, columns[2]!)).toBe('x-a');

    // si no hay cell/template, retorna el campo
    expect(component.cellValue(rows[0]!, columns[0]!)).toBe('1');
  });

  it('headerClass normaliza correctamente', () => {
    const cls = component.headerClass(columns[0]!);
    expect(cls).toContain('text-right');
    expect(cls).not.toContain('hidden'); // hidden:false no debe aparecer
  });

  it('colClass combina bodyClass + reglas extra (estado/id)', () => {
    // estado: INC => agrega rojo por la regla del componente
    const incCls = component.colClass(rows[0]!, columns[1]!);
    expect(incCls).toContain('text-red-600');
    expect(incCls).toContain('font-medium');

    // estado: OK => respeta bodyClass verde
    const okCls = component.colClass(rows[1]!, columns[1]!);
    expect(okCls).toContain('text-green-600');

    // id => agrega tabular-nums
    const idCls = component.colClass(rows[0]!, columns[0]!);
    expect(idCls).toContain('tabular-nums');
  });

  it('onPrimePage emite {pageIndex, pageSize, length}', (done) => {
    component.totalRecords = 25;

    component.page.subscribe((e) => {
      expect(e.pageIndex).toBe(2);
      expect(e.pageSize).toBe(5);
      expect(e.length).toBe(25);
      done();
    });

    component.onPrimePage({ first: 10, rows: 5, page: 2 });
  });

  it('onPrimePage calcula pageIndex cuando no viene e.page', (done) => {
    component.totalRecords = 99;

    component.page.subscribe((e) => {
      expect(e.pageIndex).toBe(3); // 15/5 = 3
      expect(e.pageSize).toBe(5);
      expect(e.length).toBe(99);
      done();
    });

    component.onPrimePage({ first: 15, rows: 5 }); // sin page explícito
  });

  it('ngOnChanges acota first al rango [0..maxFirst]', () => {
    // total=42, rows=5 => last=8 => maxFirst=8*5=40
    component.totalRecords = 42;
    component.rows = 5;

    // first no-finito => 0
    component.first = Number.NaN as any;
    component.ngOnChanges({ totalRecords: {} as any, rows: {} as any, first: {} as any });
    expect(component.first).toBe(0);

    // first demasiado grande => maxFirst
    component.first = 999 as any;
    component.ngOnChanges({ totalRecords: {} as any, rows: {} as any, first: {} as any });
    expect(component.first).toBe(40);
  });

  it('aliases: data/length/pageIndex mapean a value/totalRecords/first', () => {
    component.data = [rows[0]!];
    expect(component.value.length).toBe(1);

    component.length = 33;
    expect(component.totalRecords).toBe(33);

    component.rows = 5;
    component.pageIndex = 2; // => first = 10
    expect(component.first).toBe(10);
  });
});
