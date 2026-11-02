import { useEffect, useState } from 'react';
import { DateTime } from 'luxon';
import { Constants } from 'app/utils/constants';

const bcNow = () => DateTime.now().setZone(Constants.BC_ZONE);
const bcDayOf = (at: DateTime) => at.toFormat('yyyy-MM-dd');

/** Today's date in BC as YYYY-MM-DD; re-renders at each BC midnight. */
export function useBcToday(): string {
  const [today, setToday] = useState(() => bcDayOf(bcNow()));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    // Re-arms every time: a timer that fires early leaves the day as it was.
    const arm = () => {
      const now = bcNow();
      const untilMidnight = now.plus({ days: 1 }).startOf('day').diff(now).toMillis();
      timer = setTimeout(() => {
        setToday(bcDayOf(bcNow()));
        arm();
      }, untilMidnight);
    };
    arm();
    return () => clearTimeout(timer);
  }, []);
  return today;
}
