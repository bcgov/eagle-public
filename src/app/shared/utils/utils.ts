import { Injectable, inject } from '@angular/core';
import { ISearchResults } from 'app/models/search';
import { Constants } from './constants';
import { AnalyticsService } from 'app/services/analytics/analytics.service';

const encode = encodeURIComponent;
window['encodeURIComponent'] = (component: string | number | boolean) => {
  return encode(String(component)).replace(/[!'()*]/g, (c) => {
  // Also encode !, ', (, ), and *
    return '%' + c.charCodeAt(0).toString(16);
  });
};

@Injectable({providedIn:'root'})
export class Utils {
  private analytics = inject(AnalyticsService);

  public encodeString(filename: string, isUrl: boolean) {
    let safeName;
    if (isUrl) {
      safeName = encode(filename).replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\\/g, '_').replace(/\//g, '_').replace(/%2F/g, '_').replace(/ /g, '_');
        return safeName;
    } else {
        safeName = filename.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\\/g, '_').replace(/\//g, '_');
        return safeName;
    }

  }

  // This function will take in a ISearchResults of some type and return an array of that same type
  public extractFromSearchResults<T>(results: ISearchResults<T>[]): T[] | null {
    if (!results || !Array.isArray(results)) {
      return null;
    }
    // WHY: the Array.isArray guard above does not cover an EMPTY array - `results[0].data`
    // on `[]` threw a TypeError before anything downstream could handle it. Both callers
    // (project.service.ts:51 and :249) hand us whatever search.service.getSearchResults
    // produced, and that is `[]` whenever the backend answers 2xx with no result envelope.
    // Optional-chaining here fixes it once for every caller instead of at each call site.
    const data = results[0]?.data;
    if (!data) { return null; }
    // `?? null` because the declared `T[] | null` was a lie without it: a data-bearing envelope
    // carrying no `searchResults` returned `undefined`, and the `as T[]` cast hid that from every
    // caller's type. One call site discriminated on `=== null` and silently skipped its diagnostic
    // for that shape while its sibling used `!results` and did not.
    return (data.searchResults ?? null) as T[] | null;
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
  public createProjectTabModifiers(projectTab: string, list: any[]) {
    let types: object[] = [];
    let milestones: object[] = [];
    let phases: string | undefined;

    switch (projectTab) {
      case Constants.optionalProjectDocTabs.UNSUBSCRIBE_CAC:
        break;
      case Constants.optionalProjectDocTabs.AMENDMENT: {
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
      }
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
          { legislation: 2018, name: 'Certificate Extension' },
          { legislation: 2018, name: 'Transfer of Certificate/Order' }
        ];
        break;
      case Constants.optionalProjectDocTabs.APPLICATION: {
        // Application documents are identified by type and milestone only.
        // Adding projectPhase filter causes query issues with many AND conditions.
        types = [
          { legislation: 2002, name: 'Application Materials' },
          { legislation: 2018, name: 'Application Materials' },
          { legislation: 2002, name: 'Scientific Memo' },
          { legislation: 2018, name: 'Independent Memo' }
        ];
        milestones = [
          { legislation: 2002, name: 'Application Review' },
          { legislation: 2018, name: 'EAC Application' },
          { legislation: 2018, name: 'Revised EAC Application' },
        ];
        break;
      }
    }

    const typeIds = this.getIdsByName(types, list).map(type => type.id).join(',');
    const milestoneIds = this.getIdsByName(milestones, list).map(milestone => milestone.id).join(',');

    const queryModifier: Record<string, string> = {
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
  public getIdsByName(terms: any[], list: any[]) {
    const matchedItems = terms.map(term => {
      const listItem = list.find(item => item.name === term.name && item.legislation === term.legislation)
      return {
        name: term.name,
        id: listItem._id
      }
    });
    return matchedItems;
  }

  /**
   * Looks up a list item by ID and returns its name.
   * Commonly used in table rows to display human-readable names for IDs.
   * @param id The ID to look up
   * @param lists Array of list items with _id and name properties
   * @returns The name of the matching item, or '-' if not found
   */
  public idToListName(id: string, lists: any[]): string {
    if (!id) return '-';
    if (!lists?.length) return '-';
    
    const item = lists.find(listItem => listItem._id === id);
    return item?.name ?? '-';
  }

  /**
   * Opens a document download in a new browser tab.
   * @param document Document object with _id, documentFileName, displayName, or internalOriginalName
   */
  public openDocumentDownload(document: { _id: string; documentFileName?: string; displayName?: string; internalOriginalName?: string }): void {
    const filename = document.documentFileName || document.displayName || document.internalOriginalName || 'document';
    
    // Track document download
    this.analytics.track('Document Downloaded', {
      document_id: document._id,
      document_name: filename,
      document_type: 'unknown'
    });
    
    const safeName = this.encodeString(filename, true);
    window.open(`/api/public/document/${document._id}/download/${safeName}`, '_blank');
  }

  /**
   * Converts an NgbDateStruct (and optional NgbTimeStruct) to a JavaScript Date.
   * @param nGBDate NgbDateStruct with year, month, day properties
   * @param nGBTime Optional NgbTimeStruct with hour, minute properties
   * @returns JavaScript Date object or null if input is invalid
   */
  public convertFormGroupNGBDateToJSDate(nGBDate: { year: number; month: number; day: number }, nGBTime: { hour: number; minute: number } | null = null): Date | null {
    if (!nGBDate) {
      return null;
    }

    if (nGBTime === null) {
      return new Date(nGBDate.year, nGBDate.month - 1, nGBDate.day);
    } else {
      return new Date(nGBDate.year, nGBDate.month - 1, nGBDate.day, nGBTime.hour, nGBTime.minute);
    }
  }
}
