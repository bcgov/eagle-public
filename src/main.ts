import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { LoggingService } from './app/services/logging.service';

// Bootstrap failed, so there is no injector to ask for the logger.
bootstrapApplication(App, appConfig)
  .catch((err) => new LoggingService().error('bootstrap failed', 'main', err));
