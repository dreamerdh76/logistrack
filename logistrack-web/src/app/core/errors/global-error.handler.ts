import { ErrorHandler, Injectable } from '@angular/core';
@Injectable({ providedIn: 'root' })
export class GlobalErrorHandler implements ErrorHandler {
  handleError(e: any): void {
    console.error('[GlobalError]', e);
  }
}
