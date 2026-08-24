import { FilterType } from 'app/shared/components/search-filter-template/filter-object';
import { IColumnObject } from 'app/shared/components/table-template/table-object';
import { Constants } from 'app/shared/utils/constants';

export const PROJECT_LIST_TABLE_ID = 'projectList';

export const PROJECT_LIST_TABLE_COLUMNS: IColumnObject[] = [
  {
    name: 'Name',
    value: 'name',
    width: 'col-2'
  },
  {
    name: 'Proponent',
    value: 'proponent.name',
    width: 'col-2'
  },
  {
    name: 'Type',
    value: 'type',
    width: 'col-2'
  },
  {
    name: 'Region',
    value: 'region',
    width: 'col-2'
  },
  {
    name: 'Phase',
    value: 'currentPhaseName',
    width: 'col-2'
  },
  {
    name: 'Decision',
    value: 'eacDecision',
    width: 'col-2'
  }
];

export const LEGISLATION_FILTER_GROUP = {
  name: 'legislation',
  labelPrefix: '',
  labelPostfix: ' Act Terms'
};

export interface FilterConfig {
  id: string;
  type: FilterType;
  label: string;
  options?: any[];
  panelSize?: number;
  dateConfig?: {
    startId: string;
    startLabel: string;
    endId: string;
    endLabel: string;
  };
  useGroup?: boolean;
  matchId?: boolean;
}

export const FILTER_CONFIGS: FilterConfig[] = [
  {
    id: 'eacDecision',
    type: FilterType.MultiSelect,
    label: 'EA Decision',
    options: [], // populated from ConfigService
    panelSize: 4,
    useGroup: true,
    matchId: true
  },
  {
    id: 'issuedDate',
    type: FilterType.DateRange,
    label: '',
    panelSize: 8,
    dateConfig: {
      startId: 'decisionDateStart',
      startLabel: 'Decision Start',
      endId: 'decisionDateEnd',
      endLabel: 'Decision End'
    }
  },
  {
    id: 'type',
    type: FilterType.MultiSelect,
    label: 'Project Type',
    options: Constants.TEMPORARY_PROJECT_TYPE,
    panelSize: 4,
    matchId: true
  },
  {
    id: 'proponent',
    type: FilterType.MultiSelect,
    label: 'Proponent',
    options: [], // populated from OrgService
    panelSize: 4,
    matchId: true
  },
  {
    id: 'region',
    type: FilterType.MultiSelect,
    label: 'Region',
    options: Constants.REGIONS_COLLECTION,
    panelSize: 4,
    matchId: true
  },
  {
    id: 'CEAAInvolvement',
    type: FilterType.MultiSelect,
    label: 'IAAC Involvement',
    options: [], // populated from ConfigService
    panelSize: 4,
    useGroup: true,
    matchId: true
  },
  {
    id: 'currentPhaseName',
    type: FilterType.MultiSelect,
    label: 'Project Phase',
    options: [], // populated from ConfigService
    panelSize: 4,
    useGroup: true,
    matchId: true
  }
];

export const FILTER_LIST: string[] = ['type', 'eacDecision', 'decisionDateStart', 'decisionDateEnd', 'proponent', 'region', 'CEAAInvolvement', 'currentPhaseName'];
export const DATE_FILTER_LIST: string[] = ['decisionDateStart', 'decisionDateEnd'];
