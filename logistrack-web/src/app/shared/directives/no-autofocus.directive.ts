// src/app/shared/directives/no-autofocus.directive.ts
import {
  AfterViewInit, Directive, ElementRef, Inject, OnDestroy, PLATFORM_ID
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

@Directive({
  selector: '[appNoAutofocus]',
  standalone: true,
})
export class NoAutofocusDirective implements AfterViewInit, OnDestroy {
  private mo?: MutationObserver;
  private readonly isBrowser: boolean;

  constructor(
    private host: ElementRef<HTMLElement>,
    @Inject(DOCUMENT) private doc: Document,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  /** Limpia el propio elemento y sus descendientes */
  private stripAutofocus = (root: Element) => {
    if (!this.isBrowser) return;

    const cleanOne = (el: Element) => {
      if (el.hasAttribute?.('autofocus')) {
        el.removeAttribute('autofocus');
        if (el === this.doc.activeElement) (el as HTMLElement).blur?.();
      }
    };

    // 1) el propio root
    cleanOne(root);
    // 2) todos los descendientes
    root.querySelectorAll('[autofocus]').forEach(cleanOne);

    // 3) seguridad extra por si el activo aún lo tiene
    const active = this.doc.activeElement as HTMLElement | null;
    if (active?.hasAttribute?.('autofocus')) {
      active.removeAttribute('autofocus');
      active.blur?.();
    }
  };

  ngAfterViewInit() {
    if (!this.isBrowser) return;

    // Limpieza inicial
    this.stripAutofocus(this.host.nativeElement);

    // Observer (si el navegador lo soporta)
    const MO: typeof MutationObserver | undefined =
      typeof (globalThis as any).MutationObserver !== 'undefined'
        ? (globalThis as any).MutationObserver
        : undefined;
    if (!MO) return;

    this.mo = new MO(muts => {
      for (const m of muts) {
        if (m.type === 'childList') {
          m.addedNodes.forEach(n => n instanceof Element && this.stripAutofocus(n));
        } else if (m.type === 'attributes' && m.attributeName === 'autofocus') {
          this.stripAutofocus(m.target as Element);
        }
      }
    });

    this.mo.observe(this.host.nativeElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['autofocus'],
    });
  }

  ngOnDestroy() { this.mo?.disconnect(); }
}
