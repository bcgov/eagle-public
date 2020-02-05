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

  public encodeString(filename: string, isUrl: boolean) {
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

  // Creates query modifiers used for tab display in a project.
  public createProjectTabModifiers(list: Array<object>) {
    const certTypes = [
      { legislation: 2002, name: 'Certificate Package' },
      { legislation: 2018, name: 'Certificate Package' }
    ];
    const certMilestones = [
      { legislation: 2002, name: 'Certificate' },
      { legislation: 2018, name: 'Certificate Decision' }
    ];
    /* Removed so that authors other than EAO can submit certificates as author is not supposed to be a determiner of what is a valid certifcate
    Does not appear to be used elsewhere but left in incase this assumption is incorrect.
    const certAuthTypes = [
      { legislation: 2002, name: 'EAO' },
      { legislation: 2018, name: 'EAO' }
    ];
    */
    const amendTypes = [
      { legislation: 2002, name: 'Amendment Package' },
      { legislation: 2018, name: 'Amendment Package' }
    ];
    const amendMilestones = [
      { legislation: 2002, name: 'Amendment' },
      { legislation: 2018, name: 'Amendment' }
    ];

    const certTypesIds = this.getIdsByName(certTypes, list).map(type => type.id).join(',');
    const certMilestonesIds = this.getIdsByName(certMilestones, list).map(milestone => milestone.id).join(',');
    // const certAuthTypesIds = this.getIdsByName(certAuthTypes, list).map(type => type.id).join(',');
    const amendTypesIds = this.getIdsByName(amendTypes, list).map(type => type.id).join(',');
    const amendMilestonesIds = this.getIdsByName(amendMilestones, list).map(milestone => milestone.id).join(',');

    return {
      CERTIFICATE: {
        documentSource: 'PROJECT',
        type: certTypesIds,

        milestone: certMilestonesIds,
      },
      AMENDMENT: {
        documentSource: 'PROJECT',
        type: amendTypesIds,
        //  documentAuthorType: certAuthTypesIds,
        milestone: amendMilestonesIds,
      }
    };
  }

  // Searches the list of terms for a name and legislation year.
  public getIdsByName(terms: Array<any>, list: Array<any>) {
    const matchedItems = terms.map(term => {
      const listItem = list.find(item => item.name === term.name && item.legislation === term.legislation)
      return {
        name: term.name,
        id: listItem._id
      }
    });
    return matchedItems;
  }
}
