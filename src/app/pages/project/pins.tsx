import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { getPins } from 'app/api/project';
import { TableTemplate } from 'app/components/table/table-template';
import {
  tableObject,
  type IColumnObject,
  type ITableMessage,
  type TableRowProps,
} from 'app/components/table/table-object';
import {
  normalizeSortBy,
  paramsToObject,
  toggleSortDirection,
  toSearchParams,
} from 'app/components/table/table-params';
import { Constants } from 'app/utils/constants';
import { useProjectContext } from './project-context';

const COLUMNS: IColumnObject[] = [
  { name: 'Nation Name', value: 'name', width: 'col-8' },
  { name: 'Location', value: 'province', width: 'col-4' },
];

const DEFAULT_SORT = '+name';

function PinsTableRow({ rowData }: TableRowProps) {
  return (
    <tr>
      <td data-label="Nation Name" className="col-8" tabIndex={0}>
        {rowData.name}
      </td>
      <td data-label="Location" className="col-4" tabIndex={0}>
        {rowData.province}
      </td>
    </tr>
  );
}

/** Participating Indigenous Nations for the project. Its own `*Pins` query params. */
export function Pins() {
  const { projId } = useProjectContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => paramsToObject(searchParams), [searchParams]);

  const currentPage = +(params['currentPagePins'] || Constants.tableDefaults.DEFAULT_CURRENT_PAGE);
  const pageSize = +(params['pageSizePins'] || Constants.tableDefaults.DEFAULT_PAGE_SIZE);
  const sortBy = params['sortByPins'] ? normalizeSortBy(params['sortByPins']) : DEFAULT_SORT;

  const { data: result, isPending } = useQuery({
    queryKey: ['pins', projId, currentPage, pageSize, sortBy],
    enabled: !!projId,
    queryFn: async () => {
      const response = await getPins(projId, currentPage, pageSize, sortBy);
      const page = response?.[0];
      return { data: page?.results ?? [], totalListItems: page?.total_items ?? 0 };
    },
  });

  const totalListItems = result?.totalListItems ?? 0;

  const data = useMemo(
    () => ({
      ...tableObject({
        tableId: 'pins-table',
        component: PinsTableRow,
        columns: COLUMNS,
        currentPage,
        pageSize,
        sortBy,
        items: (result?.data ?? []).map((record) => ({ rowData: record })),
        totalListItems,
      }),
      options: {
        showHeader: true,
        showPagination: true,
        showPageCountDisplay: false,
        showPageSizePicker: false,
        showTopControls: true,
        disableRowHighlight: true,
      },
    }),
    [currentPage, pageSize, sortBy, result?.data, totalListItems],
  );

  if (!isPending && totalListItems === 0) {
    return null;
  }

  function onMessage(msg: ITableMessage): void {
    switch (msg.label) {
      case 'columnSort':
        setSearchParams(
          toSearchParams({
            ...params,
            sortByPins: toggleSortDirection(sortBy, msg.data),
            currentPagePins: 1,
          }),
          { replace: true },
        );
        break;
      case 'pageNum':
        setSearchParams(toSearchParams({ ...params, currentPagePins: msg.data }), {
          replace: true,
        });
        break;
    }
  }

  return (
    <section aria-labelledby="pins-title">
      <h2 id="pins-title">Participating Indigenous Nations</h2>
      <TableTemplate data={data} loading={isPending} onMessage={onMessage} />
    </section>
  );
}
