import { Injectable } from '@angular/core';

const encode = encodeURIComponent;
window['encodeURIComponent'] = (component: string) => {
  return encode(component).replace(/[!'()*]/g, (c) => {
  // Also encode !, ', (, ), and *
    return '%' + c.charCodeAt(0).toString(16);
  });
};

@Injectable()
export class Utils {
  constructor() { }

  public encodeFilename(filename: string, isUrl: boolean) {
    let safeName;
    if (isUrl) {
        return safeName = encode(filename).replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\\/g, '_').replace(/\//g, '_').replace(/\%2F/g, '_');
    } else {
        return safeName = filename.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\\/g, '_').replace(/\//g, '_');
    }

  }
}
