import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class InterceptorInterceptor implements HttpInterceptor {

  constructor() {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const idToken = localStorage.getItem("idToken");

    if (idToken) {
      // Clone the request and set the new header in one step.
      const cloned = request.clone({
        headers: request.headers.set('Authorization', `Bearer ${idToken}`)
      });
      return next.handle(cloned);
    }

    // If no token, just pass the request as it is.
    return next.handle(request);
  }
}