import { ApplicationConfig, ErrorHandler } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { requestIdInterceptor } from './core/interceptors/request-id.interceptor';
import { GlobalErrorHandler } from './core/errors/global-error.handler';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { providePrimeNG } from 'primeng/config';
import AuraPreset from '@primeuix/themes/aura';

// normaliza el preset por si viene como { default: ... }
const Aura = (AuraPreset as any)?.default ?? AuraPreset;

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([requestIdInterceptor])),
    provideAnimationsAsync(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          cssLayer: {
            name: 'primeng',
            order: 'theme, base, primeng'
          },
          darkModeSelector: '.dark'
        }
      },
      ripple: true
    })
  ],
};
