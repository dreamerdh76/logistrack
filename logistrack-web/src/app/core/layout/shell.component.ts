import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';

import { DrawerModule } from 'primeng/drawer';
import { PanelMenuModule } from 'primeng/panelmenu';
import { ButtonModule } from 'primeng/button';
import { MenuItem } from 'primeng/api';

import { BreakpointObserver } from '@angular/cdk/layout';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, map, shareReplay } from 'rxjs/operators';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, DrawerModule, PanelMenuModule, ButtonModule],
  templateUrl: './shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  private readonly router = inject(Router);
  private readonly bp = inject(BreakpointObserver);

  mobileOpen = false;

  // Desktop si width >= 768px (ajusta si tu "md" cambia)
  readonly isDesktop$ = this.bp.observe('(min-width: 768px)')
    .pipe(map(r => r.matches), shareReplay({ bufferSize: 1, refCount: true }));

  // Modelo del PanelMenu (router + cierre del drawer en móvil)
  readonly items: MenuItem[] = [
    { label: 'Despacho',      icon: 'pi pi-truck',      routerLink: ['/despacho'],      command: () => this.mobileOpen = false },
    { label: 'Preparación',   icon: 'pi pi-wrench',     routerLink: ['/preparacion'],   command: () => this.mobileOpen = false },
    { label: 'Expedición',    icon: 'pi pi-send',       routerLink: ['/expedicion'],    command: () => this.mobileOpen = false },
    { label: 'Recepción',     icon: 'pi pi-inbox',      routerLink: ['/recepcion'],     command: () => this.mobileOpen = false },
    { label: 'Consolidación', icon: 'pi pi-box',        routerLink: ['/consolidacion'], command: () => this.mobileOpen = false },
    { label: 'Distribución',  icon: 'pi pi-share-alt',  routerLink: ['/distribucion'],  command: () => this.mobileOpen = false },
  ];

  constructor() {
    // 1) Al llegar a desktop, cierra el drawer para evitar estados cruzados
    this.isDesktop$
      .pipe(filter(Boolean), takeUntilDestroyed())
      .subscribe(() => (this.mobileOpen = false));

    // 2) Al navegar, cierra el drawer
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => (this.mobileOpen = false));
  }

  openDrawer()  { this.mobileOpen = true; }
  closeDrawer() { this.mobileOpen = false; }
}
