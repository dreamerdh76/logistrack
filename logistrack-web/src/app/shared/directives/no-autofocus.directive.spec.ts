// src/app/shared/directives/no-autofocus.directive.spec.ts
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { provideZonelessChangeDetection } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { NoAutofocusDirective } from './no-autofocus.directive';

// Host mínimo para aplicar la directiva
@Component({
  standalone: true,
  imports: [NoAutofocusDirective],
  template: `
    <div appNoAutofocus>
      <input id="pre" autofocus />
      <div id="slot"></div>
    </div>
  `,
})
class HostComponent {}

const flushMO = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

let lastMO: FakeMO | null = null;
class FakeMO {
  observeCalls = 0;
  disconnectCalls = 0;
  constructor(private cb: MutationCallback) { lastMO = this; }
  observe() { this.observeCalls++; }
  disconnect() { this.disconnectCalls++; }
  trigger(muts: MutationRecord[]) { this.cb(muts, this as unknown as MutationObserver); }
}

describe('NoAutofocusDirective (browser)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  it('remueve autofocus en el subtree al iniciar', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.detectChanges(); // -> ngAfterViewInit
    const doc: Document = TestBed.inject(DOCUMENT);
    const pre = doc.getElementById('pre')!;
    expect(pre.hasAttribute('autofocus')).toBeFalse();
  });

  it('elimina autofocus cuando se agregan hijos con ese atributo', async () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.detectChanges();

    const doc = TestBed.inject(DOCUMENT);
    const slot = doc.getElementById('slot')!;
    const input = doc.createElement('input');

    input.setAttribute('autofocus', '');
    slot.appendChild(input);

    await flushMO();
    await flushMO();

    expect(input.hasAttribute('autofocus')).toBeFalse();
  });

  it('elimina autofocus cuando se añade el atributo posteriormente', async () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.detectChanges();

    const doc = TestBed.inject(DOCUMENT);
    const slot = doc.getElementById('slot')!;
    const el = doc.createElement('input');
    slot.appendChild(el);

    await flushMO(); // que el observer se enganche

    el.setAttribute('autofocus', '');
    await flushMO(); // procesar mutación de atributo

    expect(el.hasAttribute('autofocus')).toBeFalse();
  });

  it('si el elemento activo tiene autofocus, lo borra y hace blur()', async () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.detectChanges();

    const doc = TestBed.inject(DOCUMENT);
    const slot = doc.getElementById('slot')!;

    const el = doc.createElement('input');
    slot.appendChild(el);
    await new Promise(r => setTimeout(r));

    el.focus();
    const blurSpy = spyOn(el, 'blur').and.callThrough();

    el.setAttribute('autofocus', '');
    await new Promise(r => setTimeout(r));

    expect(blurSpy).toHaveBeenCalled();
    expect(el.hasAttribute('autofocus')).toBeFalse();
  });

  it('desconecta el MutationObserver en ngOnDestroy', async () => {
    const realMO = (globalThis as any).MutationObserver;
    (globalThis as any).MutationObserver = FakeMO as any;

    try {
      const fx = TestBed.createComponent(HostComponent);
      fx.detectChanges();
      expect(lastMO).toBeTruthy();

      fx.destroy(); // -> ngOnDestroy
      expect(lastMO!.disconnectCalls).toBe(1);
    } finally {
      (globalThis as any).MutationObserver = realMO;
      lastMO = null;
    }
  });
});

describe('NoAutofocusDirective (SSR / no-browser)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    }).compileComponents();
  });

  it('no modifica atributos si no está en plataforma browser', () => {
    expect(isPlatformBrowser(TestBed.inject(PLATFORM_ID))).toBeFalse();

    const fx = TestBed.createComponent(HostComponent);
    fx.detectChanges();

    const doc: Document = TestBed.inject(DOCUMENT);
    const pre = doc.getElementById('pre')!;
    expect(pre.hasAttribute('autofocus')).toBeTrue(); // ¡no lo tocó!
  });
});
