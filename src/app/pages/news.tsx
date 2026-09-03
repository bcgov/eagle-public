import { SubscribePopover } from 'app/components/subscribe-popover';
import { TableList } from 'app/components/table/table-list';
import { getNotifyApi } from 'app/config/config';
import { newsConfig } from './news.config';

export function News() {
  return (
    <TableList config={newsConfig}>
      {/* Same band, same place as a project's Activities and Updates: under the title, above the
          search. The guard keeps the padding out of the page when NOTIFY_API is unset. */}
      {getNotifyApi() ? (
        <div className="container pb-3">
          <SubscribePopover serviceName="eao:updates" variant="all" />
        </div>
      ) : null}
    </TableList>
  );
}
