import { History, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api.ts";
import { Pager } from "../components/Pager.tsx";
import { PageHead, Shell } from "../components/Shell.tsx";
import { formatDate, formatDay } from "../format.ts";
import type { ActivityItem, ActivityPage as ActivityPageData } from "../types.ts";

// Puts entries under a heading for each day, keeping them newest first.
function groupByDay(items: ActivityItem[]): { day: string; items: ActivityItem[] }[] {
  const groups: { day: string; items: ActivityItem[] }[] = [];
  for (const item of items) {
    const day = formatDay(item.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return groups;
}

export function ActivityPage() {
  return (
    <Shell>
      <div className="page">
        <PageHead title="Activity" subtitle="Everything people have done in this workspace, newest first." />
        <ActivityLog />
      </div>
    </Shell>
  );
}

// The searchable history. Also shown as a tab on the Settings page.
export function ActivityLog() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ActivityPageData>({ items: [], total: 0, pageSize: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const items = result.items;
  const top = useRef<HTMLDivElement>(null);

  // Waits until typing pauses, so each key press does not send a request.
  // Turning the page loads straight away.
  const lastSearch = useRef(search);
  useEffect(() => {
    let isCurrent = true;
    const isTyping = lastSearch.current !== search;
    lastSearch.current = search;
    const timer = setTimeout(async () => {
      try {
        const loaded = await api.activity(search.trim(), page);
        if (!isCurrent) return;
        setResult(loaded);
        setError(null);
      } catch (problem) {
        if (isCurrent) setError((problem as Error).message);
      } finally {
        if (isCurrent) setLoading(false);
      }
    }, isTyping ? 250 : 0);
    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [search, page]);

  function changeSearch(text: string) {
    setSearch(text);
    setPage(1);
  }

  function turnPage(number: number) {
    setPage(number);
    top.current?.scrollIntoView({ block: "nearest" });
  }

  return (
    <>
      <div className="list-search" ref={top}>
        <span className="search-ic"><Search size={14} aria-hidden="true" /></span>
        <input className="input" type="search" aria-label="Search activity" placeholder="Search by person or action" value={search} onChange={(event) => changeSearch(event.target.value)} />
      </div>

      {error && <div className="notice err">{error}</div>}

      {loading ? (
        <div className="card"><div className="card-b"><span className="skel" /></div></div>
      ) : items.length === 0 ? (
        <div className="card">
          <div className="empty">
            <span className="empty-ic"><History size={20} aria-hidden="true" /></span>
            <strong>{search.trim() ? "No activity matches" : "No activity yet"}</strong>
            <p className="muted">{search.trim() ? "Try a different name or word." : "Changes people make to workflows, connections and the team appear here."}</p>
          </div>
        </div>
      ) : (
        <>
          {groupByDay(items).map((group) => (
            <section className="card" key={group.day}>
              <div className="card-h"><h2 className="card-t">{group.day}</h2></div>
              {group.items.map((item) => (
                <div className="activity-row" key={item.id}>
                  <span><span className="strong">{item.actorName}</span> {item.description}</span>
                  <span className="small dim">{formatDate(item.createdAt)}</span>
                </div>
              ))}
            </section>
          ))}
          <Pager page={page} pageSize={result.pageSize} total={result.total} onChange={turnPage} />
        </>
      )}
    </>
  );
}
