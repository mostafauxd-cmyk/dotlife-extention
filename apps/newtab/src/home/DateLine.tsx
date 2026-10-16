import { Fragment } from "react";

import { useNow } from "../hooks";
import { todayInfo } from "../today";
import { clock } from "../ui/fa";

/** Under the search box: the time · the Solar Hijri date · the day's first occasion. */
export function DateLine() {
  const now = useNow(1000);
  const t = todayInfo(now);
  const occ = t.occasions[0];
  const parts = [
    <span key="c" className="clock">
      {clock(now)}
    </span>,
    <span key="d">
      {t.weekday} {t.solar}
    </span>,
    ...(occ !== undefined
      ? [
          <span key="o" className={occ.event.holiday ? "hol" : ""}>
            {occ.event.title}
          </span>,
        ]
      : []),
  ];
  return (
    <div className="dateline">
      {parts.map((p, i) => (
        <Fragment key={p.key}>
          {i > 0 && <i />}
          {p}
        </Fragment>
      ))}
    </div>
  );
}
