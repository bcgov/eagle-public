import { ViewContainerRef, Injectable, Type, ComponentRef } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class InjectComponentService {
  /**
   * Inject the provided component into the provided view.
   * In Angular 21, ComponentFactoryResolver is deprecated, use ViewContainerRef.createComponent directly.
   *
   * @param {ViewContainerRef} viewContainerRef
   * @param {Type<any>} componentToInject
   * @returns {ComponentRef<any>}
   * @memberof InjectComponentService
   */
  injectComponentIntoView(viewContainerRef: ViewContainerRef, componentToInject: Type<any>): ComponentRef<any> {
    viewContainerRef.clear();
    const componentRef = viewContainerRef.createComponent(componentToInject);
    return componentRef;
  }
}
