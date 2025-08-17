// src/app/shared/ui/filters-bar/filters-bar.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, PLATFORM_ID } from '@angular/core';
import { FiltersBarComponent, FilterField } from './filters-bar.component';

describe('FiltersBarComponent (standalone, zoneless)', () => {
  let component: FiltersBarComponent;

  const fields: FilterField[] = [
    { type: 'text',    name: 'cd',          label: 'CD' },
    { type: 'select',  name: 'estado',      label: 'Estado', options: [
      { value: 'PEN', label: 'Pendiente' }, { value: 'ENT', label: 'Entregada' }
    ]},
    { type: 'date',    name: 'fecha',       label: 'Fecha' },
    { type: 'boolean', name: 'incidencias', label: 'Incidencias' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FiltersBarComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: PLATFORM_ID, useValue: 'browser' }, // SSR-safe en tests
      ],
    }).compileComponents();

    component = TestBed.createComponent(FiltersBarComponent).componentInstance;
    component.debounce = 0; // sin esperas en tests
  });

  function initWith(value: Record<string, any> = {}) {
    component.fields = fields;
    component.value  = value;
    component.ngOnChanges({ fields: {} as any, value: {} as any });
  }

  it('debe crearse', () => {
    expect(component).toBeTruthy();
  });

  it('construye el form y convierte fecha (YYYY-MM-DD → Date local)', () => {
    initWith({ cd: 'CD1', estado: 'PEN', fecha: '2025-08-15', incidencias: true });

    const v = component.form.getRawValue();
    expect(Object.keys(v)).toEqual(['cd','estado','fecha','incidencias']);
    expect(v.cd).toBe('CD1');
    expect(v.estado).toBe('PEN');
    expect(v.fecha instanceof Date).toBeTrue();
    expect(v.fecha.getFullYear()).toBe(2025);
    expect(v.fecha.getMonth()).toBe(7);
    expect(v.fecha.getDate()).toBe(15);
    expect(v.incidencias).toBeTrue();
  });

  it('autoApply emite filtersChange con valor limpio (trim/boolean/date)', (done) => {
    component.autoApply = true;
    initWith();

    component.filtersChange.subscribe(e => {
      expect(e).toEqual({
        cd: 'CD-01',
        estado: 'PEN',
        fecha: '2025-01-02',
        incidencias: true,
      });
      done();
    });

    component.form.get('cd')!.setValue('  CD-01  ');
    component.form.get('estado')!.setValue('PEN');
    component.form.get('fecha')!.setValue(new Date(2025, 0, 2));
    component.form.get('incidencias')!.setValue(true);
  });

  it('cuando autoApply=false no emite hasta apply()', () => {
    component.autoApply = false;
    initWith();

    let last: any | null = null;
    component.filtersChange.subscribe(v => (last = v));

    component.form.get('cd')!.setValue('X'); // no emite
    expect(last).toBeNull();

    component.apply(); // ahora sí
    expect(last).toEqual({ cd: 'X' });
  });

  it('clear() resetea, emite cleared y luego filtersChange {}', () => {
    component.autoApply = false;
    initWith({ cd: 'CD9', estado: 'ENT', fecha: '2025-12-31', incidencias: false });

    const changes: any[] = [];
    let cleared = 0;
    component.filtersChange.subscribe(v => changes.push(v));
    component.cleared.subscribe(() => cleared++);

    component.clear();

    expect(cleared).toBe(1);
    expect(changes.pop()).toEqual({});

    const v = component.form.getRawValue();
    expect(v.cd).toBeNull();
    expect(v.estado).toBeNull();
    expect(v.incidencias).toBeNull();
    expect(v.fecha).toBeNull();
  });

  it('activeCount/hasAny cuentan correctamente', () => {
    initWith();
    expect(component.activeCount).toBe(0);
    expect(component.hasAny).toBeFalse();

    component.form.get('cd')!.setValue('CD1');
    component.form.get('incidencias')!.setValue(false); // false cuenta
    expect(component.activeCount).toBe(2);
    expect(component.hasAny).toBeTrue();

    component.clear();
    expect(component.activeCount).toBe(0);
    expect(component.hasAny).toBeFalse();
  });

  it('convierte strings "true"/"false" a boolean en apply()', () => {
    component.autoApply = false;
    initWith();

    let last: any | null = null;
    component.filtersChange.subscribe(v => (last = v));

    component.form.get('incidencias')!.setValue('true'); // string
    component.apply();

    expect(last).toEqual({ incidencias: true });
  });

  it('trackField devuelve el name del field', () => {
    expect(component.trackField(0, fields[2]!)).toBe('fecha');
  });

  it('ngOnDestroy desuscribe sin errores', () => {
    component.autoApply = true;
    initWith();
    expect(() => component.ngOnDestroy()).not.toThrow();
  });
});
