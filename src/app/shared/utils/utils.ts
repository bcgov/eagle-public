import { Injectable } from '@angular/core';

@Injectable()
export class Utils {
  constructor() { }

  public encode(component: string) {
    let encoded = encodeURIComponent(component);
    return encoded.replace(/[!'()*]/g, (c) => {
    // Also encode !, ', (, ), and *
      return '%' + c.charCodeAt(0).toString(16);
    });
  }

  public encodeFilename(filename: string, isUrl: boolean) {
    let safeName;
    if (isUrl) {
        return safeName = this.encode(filename).replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\\/g, '_').replace(/\//g, '_').replace(/\%2F/g, '_');
    } else {
        return safeName = filename.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\\/g, '_').replace(/\//g, '_');
    }

  }
}
