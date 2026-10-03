import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { LoggingService } from './logging.service';

export enum EventKeywords {
  ERROR = 'err',
  INFO = 'info',
  DEBUG = 'debug'
}

export class EventObject {
  keyword: string; // error, info, debug
  message: string;
  eventSource: string;

  constructor(keyword?: EventKeywords, message?: string, eventSource?: string) {
    this.keyword = keyword || '';
    this.message = message || '';
    this.eventSource = eventSource || '';
  }
}

/*
Example:

this.eventService.setError(
  new EventObject(
    EventKeywords.ERROR,
    'No data was returned from the server.',
    'Import Service'
  )
);

*/

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private logger = inject(LoggingService);
  private errorEvent: BehaviorSubject<EventObject>;
  private infoEvent: BehaviorSubject<EventObject>;
  private debugEvent: BehaviorSubject<EventObject>;

  constructor() {
    this.errorEvent = new BehaviorSubject<EventObject>(new EventObject);
    this.infoEvent = new BehaviorSubject<EventObject>(new EventObject);
    this.debugEvent = new BehaviorSubject<EventObject>(new EventObject);
  }

  setError(value: EventObject): void {
    this.errorEvent.next(value);
    // Automatically log errors to LoggingService
    this.logger.error(value.message, value.eventSource || 'EventService');
  }

  getError(): Observable<EventObject> {
    return this.errorEvent.asObservable();
  }

  setInfo(value: EventObject): void {
    this.infoEvent.next(value);
    // Automatically log info to LoggingService
    this.logger.info(value.message, value.eventSource || 'EventService');
  }

  getInfo(): Observable<EventObject> {
    return this.infoEvent.asObservable();
  }

  setDebug(value: EventObject): void {
    this.debugEvent.next(value);
    // Automatically log debug to LoggingService
    this.logger.debug(value.message, value.eventSource || 'EventService');
  }

  getDebug(): Observable<EventObject> {
    return this.debugEvent.asObservable();
  }
}
