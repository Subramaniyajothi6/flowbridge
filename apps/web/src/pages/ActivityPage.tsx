import { History, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api.ts";
import { PageHead, Shell } from "../components/Shell.tsx";
import { formatDate, formatDay } from "../format.ts";
import type { ActivityItem } from "../types.ts";

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
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Waits until typing pauses, so each key press does not send a request.
  useEffect(() => {
    let isCurrent = true;
    const timer = setTimeout(async () => {
      try {
        const page = await api.activity(search.trim());
        if (!isCurrent) return;
        setItems(page.items);
        setHasMore(page.hasMore);
        setError(null);
      } catch (problem) {
        if (isCurrent) setError((problem as Error).message);
      } finally {
        if (isCurrent) setLoading(false);
      }
    }, 250);
    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [search]);

  async function showMore() {
    setLoadingMore(true);
    try {
      const page = await api.activity(search.trim(), items[items.length - 1].createdAt);
      setItems([...items, ...page.items]);
      setHasMore(page.hasMore);
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <div className="list-search">
        <span className="search-ic"><Search size={14} aria-hidden="true" /></span>
        <input className="input" type="search" aria-label="Search activity" placeholder="Search by person or action" value={search} onChange={(event) => setSearch(event.target.value)} />
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
          {hasMore && (
            <div className="row activity-more">
              <button className="btn" onClick={showMore} disabled={loadingMore}>{loadingMore ? "Loading" : "Show more"}</button>
            </div>
          )}
        </>
      )}
    </>
  );
}
