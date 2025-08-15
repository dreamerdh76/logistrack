import { Injectable, Inject, PLATFORM_ID, NgZone, OnDestroy } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class AutofocusGuardService implements OnDestroy {
  private mo?: MutationObserver;
  private isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) private pid: Object,
    @Inject(DOCUMENT) private doc: Document,
    private zone: NgZone
  ) {
    this.isBrowser = isPlatformBrowser(this.pid);
    if (!this.isBrowser) return;
    const MO = (globalThis as any).MutationObserver as typeof MutationObserver | undefined;
    if (!MO) return;

    this.zone.runOutsideAngular(() => {
      this.mo = new MO((muts) => {
        for (const m of muts) {
          if (m.type === 'childList') {
            m.addedNodes.forEach(n => {
              if (n instanceof Element) this.stripAutofocus(n);
            });
          } else if (m.type === 'attributes' && m.attributeName === 'autofocus') {
            const el = m.target as HTMLElement;
            el.removeAttribute('autofocus');
            if (el === this.doc.activeElement) el.blur?.();
          }
        }
      });

      // Observa todo el body (incluye overlays de PrimeNG)
      this.mo.observe(this.doc.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['autofocus'],
      });
    });
  }

  private stripAutofocus(root: Element) {
    if (!this.isBrowser) return;
    root.querySelectorAll('[autofocus]').forEach(el => el.removeAttribute('autofocus'));
    const active = this.doc.activeElement as HTMLElement | null;
    if (active?.hasAttribute?.('autofocus')) {
      active.removeAttribute('autofocus');
      active.blur?.();
    }
  }

  ngOnDestroy() { this.mo?.disconnect(); }
}
