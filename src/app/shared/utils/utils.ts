import { Injectable } from '@angular/core';
import { ISearchResults } from 'app/models/search';

const encode = encodeURIComponent;
const buildToNature = {
  new: 'New Construction',
  modification: 'Modification of Existing',
  dismantling: 'Dismantling or Abandonment',
  unknown: 'Unknown nature value',
}
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
  public natureBuildMapper(key: string, reverseMapping: false): string {
    if (!key) {
      return '';
    }
    return (reverseMapping) ? Object.keys(buildToNature).find(aKey => buildToNature[aKey] === key) : buildToNature[key]
  }
}
