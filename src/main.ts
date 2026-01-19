// Import Leaflet and make it globally available before Angular bootstraps
import * as L from 'leaflet';
(window as any).L = L;
import 'leaflet.markercluster';

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
