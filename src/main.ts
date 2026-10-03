import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { logBootstrapFailure } from './app/services/global-error-handler';

bootstrapApplication(App, appConfig).catch(logBootstrapFailure);
