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

  private stripAutofocus = (root: Element) => {
    // Solo en browser
    if (!this.isBrowser) return;

    root.querySelectorAll('[autofocus]').forEach(el => el.removeAttribute('autofocus'));

    const active = this.doc.activeElement as HTMLElement | null;
    if (active?.hasAttribute?.('autofocus')) {
      active.removeAttribute('autofocus');
      active.blur?.();
    }
  };

  ngAfterViewInit() {
    if (!this.isBrowser) return;

    // Limpieza inicial del subárbol
    this.stripAutofocus(this.host.nativeElement);

    // Comprueba soporte del observer
    const MO: typeof MutationObserver | undefined =
      typeof (globalThis as any).MutationObserver !== 'undefined'
        ? (globalThis as any).MutationObserver
        : undefined;

    if (!MO) return; // (Safari viejo en webview, bots, etc.)

    this.mo = new MO(muts => {
      for (const m of muts) {
        if (m.type === 'childList') {
          m.addedNodes.forEach(n => n instanceof Element && this.stripAutofocus(n));
        } else if (m.type === 'attributes' && m.attributeName === 'autofocus') {
          const el = m.target as Element;
          el.removeAttribute('autofocus');
          if (el === this.doc.activeElement) (el as HTMLElement).blur?.();
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
