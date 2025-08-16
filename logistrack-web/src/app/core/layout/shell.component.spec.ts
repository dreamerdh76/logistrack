// src/app/shell/shell.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { BehaviorSubject, Subject, firstValueFrom, take } from 'rxjs';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';

import { ShellComponent } from './shell.component';

// --- Mocks ---
class MockBreakpointObserver {
  private subj = new BehaviorSubject<BreakpointState>({ matches: false, breakpoints: {} as any });
  observe = jasmine.createSpy('observe').and.callFake((_q: string | string[]) => this.subj.asObservable());
  nextMatch(v: boolean) { this.subj.next({ matches: v, breakpoints: {} as any }); }
}

describe('ShellComponent (standalone, zoneless)', () => {
  let component: ShellComponent;
  let router: jasmine.SpyObj<Router>;
  let nav$: Subject<any>;
  let bp: MockBreakpointObserver;

  beforeEach(async () => {
    nav$ = new Subject<any>();
    router = jasmine.createSpyObj<Router>('Router', ['navigate'], { events: nav$.asObservable() });

    bp = new MockBreakpointObserver();

    await TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: Router, useValue: router },
        { provide: BreakpointObserver, useValue: bp },
      ],
    }).compileComponents();

    component = TestBed.createComponent(ShellComponent).componentInstance;
  });

  it('se crea', () => {
    expect(component).toBeTruthy();
  });

  it('isDesktop$ refleja el breakpoint', async () => {
    // emite false por defecto; luego true
    bp.nextMatch(true);
    const v = await firstValueFrom(component.isDesktop$.pipe(take(1)));
    expect(v).toBeTrue();
    expect(bp.observe).toHaveBeenCalled(); // se suscribe internamente en el ctor
  });

  it('openDrawer / closeDrawer cambian mobileOpen', () => {
    component.openDrawer();
    expect(component.mobileOpen).toBeTrue();

    component.closeDrawer();
    expect(component.mobileOpen).toBeFalse();
  });

  it('al llegar a desktop, cierra el drawer', () => {
    component.mobileOpen = true;
    bp.nextMatch(true); // el ctor está suscrito a isDesktop$
    expect(component.mobileOpen).toBeFalse();
  });

  it('al navegar (NavigationEnd), cierra el drawer', () => {
    component.mobileOpen = true;
    nav$.next(new NavigationEnd(1, '/origen', '/destino'));
    expect(component.mobileOpen).toBeFalse();
  });

  it('items: cada command cierra el drawer y tienen routerLink', () => {
    // probamos el primero como muestra
    const first = component.items[0]!;
    expect(first.label).toBe('Despacho');
    expect(first.routerLink).toEqual(['/despacho']);

    component.mobileOpen = true;
    (first.command as Function)();
    expect(component.mobileOpen).toBeFalse();
  });

  it('los labels esperados están presentes en el menú', () => {
    const labels = component.items.map(i => i.label);
    expect(labels).toEqual([
      'Despacho', 'Preparación', 'Expedición', 'Recepción', 'Consolidación', 'Distribución'
    ]);
  });
});
