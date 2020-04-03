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
      safeName = encode(filename).replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\\/g, '_').replace(/\//g, '_').replace(/\%2F/g, '_').replace(/ /g, '_');
        return safeName;
    } else {
        safeName = filename.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\\/g, '_').replace(/\//g, '_');
        return safeName;
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
  public createProjectTabModifiers(projectTab: string, list: Array<any>) {
    let types: Array<object>;
    let milestones: Array<object>;
    let phases: string;

    switch (projectTab) {
      case Constants.optionalProjectDocTabs.UNSUBSCRIBE_CAC:
        break;
      case Constants.optionalProjectDocTabs.AMENDMENT:
        types = [
          { legislation: 2002, name: 'Amendment Package' },
          { legislation: 2018, name: 'Amendment Package' },
          { legislation: 2002, name: 'Request' },
          { legislation: 2002, name: 'Decision Materials' },
          { legislation: 2018, name: 'Decision Materials' },
          { legislation: 2002, name: 'Tracking Table' },
          { legislation: 2018, name: 'Tracking Table' }
        ];
        milestones = [
          { legislation: 2002, name: 'Amendment' },
          { legislation: 2018, name: 'Amendment' }
        ];

        const amendPhase = [
          { legislation: 2002, name: 'Post Decision - Amendment' },
          { legislation: 2018, name: 'Post Decision - Amendment' }
        ];

        // Special case for phases.
        phases = this.getIdsByName(amendPhase, list).map(phase => phase.id).join(',');
        break;
      case Constants.optionalProjectDocTabs.CERTIFICATE:
        types = [
          { legislation: 2002, name: 'Certificate Package' },
          { legislation: 2018, name: 'Certificate Package' },
          { legislation: 2002, name: 'Order' },
          { legislation: 2018, name: 'Order' },
          { legislation: 2002, name: 'Decision Materials' },
          { legislation: 2018, name: 'Decision Materials' }
        ];
        milestones = [
          { legislation: 2002, name: 'Certificate' },
          { legislation: 2018, name: 'Certificate Decision' },
          { legislation: 2002, name: 'Decision' },
          { legislation: 2002, name: 'Certificate Extension' },
          { legislation: 2018, name: 'Certificate Extension' }
        ];
        break;
      case Constants.optionalProjectDocTabs.APPLICATION:
        types = [
          { legislation: 2002, name: 'Application Materials' },
          { legislation: 2018, name: 'Application Materials' },
          { legislation: 2002, name: 'Scientific Memo' },
          { legislation: 2018, name: 'Independent Memo' }
        ];
        milestones = [
          { legislation: 2002, name: 'Application Review' },
          { legislation: 2018, name: 'Revised EAC Application' },
        ];

        const applications = [
          { legislation: 2002, name: 'Post Decision - Amendment' },
          { legislation: 2018, name: 'Post Decision - Amendment' }
        ];

        // Special case for phases.
        const amendmentPhaseIds = this.getIdsByName(applications, list).map(type => type.id);

        // Get all phase list items excluding the matched applications.
        phases = list.filter(item => {
          if (item.type === 'projectPhase' && !amendmentPhaseIds.includes(item._id)) {
            return true;
          }

          return false;
        })
        .map(item => item._id)
        .join(',');

        break;
    }

    const typeIds = this.getIdsByName(types, list).map(type => type.id).join(',');
    const milestoneIds = this.getIdsByName(milestones, list).map(milestone => milestone.id).join(',');

    const queryModifier = {
      documentSource: 'PROJECT',
      type: typeIds,
      milestone: milestoneIds,
    };

    if (phases) {
      queryModifier['projectPhase'] = phases;
    }

    return queryModifier;
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
