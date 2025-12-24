import { Type } from '@angular/core';
import { Observable } from 'rxjs';
import { IColumnObject } from '../table-template/table-object';
import { FilterObject } from '../search-filter-template/filter-object';
import { HeroBannerAction } from 'app/shared/hero-banner/hero-banner.component';

/**
 * Configuration interface for the generic table-list component
 */
export interface TableListConfig {
  /** Unique identifier for the table (used for loading state and table service) */
  tableId: string;
  
  /** Type of dataset being displayed ('Project' or 'Document') */
  datasetType: 'Project' | 'Document';
  
  /** Default sort field with direction (e.g., '+name', '-datePosted') */
  defaultSort: string;
  
  /** Hero banner configuration */
  heroBanner: {
    title: string;
    description: string;
    actions: HeroBannerAction[];
  };
  
  /** Table column definitions */
  tableColumns: IColumnObject[];
  
  /** Component to use for rendering table rows */
  tableRowComponent: Type<any>;
  
  /** List of filter field names (non-date filters) */
  filterList: string[];
  
  /** List of date filter field names */
  dateFilterList: string[];
  
  /** Observable that provides data needed to build filters */
  filterDataSource: Observable<any>;
  
  /** Function to build FilterObject array from the filter data source */
  filterBuilder: (data: any) => FilterObject[];
  
  /** Optional: Function to check if filters have loaded */
  isFilterDataLoaded?: (data: any) => boolean;
  
  /** Optional: Function to initialize any required services/data fetching */
  initializeData?: () => void;
}
