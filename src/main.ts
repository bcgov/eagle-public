// Import Leaflet for TypeScript support but also load as global script
import * as L from 'leaflet';
(window as any).L = L;
import 'leaflet.markercluster';

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
