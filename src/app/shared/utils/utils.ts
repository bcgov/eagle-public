import { Injectable } from '@angular/core';
import { ISearchResults } from 'app/models/search';
import { Constants } from './constants';

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
        return safeName = encode(filename).replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\\/g, '_').replace(/\//g, '_').replace(/\%2F/g, '_').replace(/ /g, '_');
    } else {
        return safeName = filename.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\\/g, '_').replace(/\//g, '_');
    }

  }

  // This function will take in a ISearchResults of some type and return an array of that same type
  public extractFromSearchResults<T>(results: ISearchResults<T>[]): T[] {
    if (!results || !Array.isArray(results)) {
      return null;
    }
    const data = results[0].data;
    if (!data) { return null; }
    return <T[]>data.searchResults;
  }
   // Mapping the build database field to the human readable nature field
   public natureBuildMapper(key: string): string {
    if (!key) {
      return '';
    }
    const natureObj = Constants.buildToNature.find(obj => obj.build === key);
    return (natureObj) ? natureObj.nature : key;
  }
}
