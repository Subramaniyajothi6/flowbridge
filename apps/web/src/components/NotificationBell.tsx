import { Bell } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../api.ts";
import { formatDate } from "../format.ts";
import type { NotificationItem } from "../types.ts";
import { useLoad } from "../useLoad.ts";
import { useDismiss } from "./useDismiss.ts";

const DOT_FOR_KIND: Record<NotificationItem["kind"], string> = {
  failed: "err",
  approval: "warn",
  retry: "warn",
  connection: "warn",
};

export function NotificationBell() {
  const { pathname } = useLocation();
  // Reloads on every page change, so the list does not go stale.
  const { data, reload } = useLoad(api.notifications, [pathname]);
  const [isOpen, setIsOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  const unread = data?.unread ?? 0;
  const close = useCallback(() => setIsOpen(false), []);
  useDismiss(container, isOpen, close);

  function toggle() {
    if (!isOpen) void reload();
    setIsOpen(!isOpen);
  }

  async function markAllRead() {
    await api.markNotificationsRead();
    await reload();
  }

  return (
    <div className="bell-wrap" ref={container}>
      <button className="btn btn-g btn-ic top-bell" aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"} aria-expanded={isOpen} onClick={toggle}>
        <Bell size={16} aria-hidden="true" />
        {unread > 0 && <span className="dot err" />}
      </button>

      {isOpen && (
        <div className="pop bell-pop">
          <div className="row between bell-head">
            <span className="strong">Notifications</span>
            {unread > 0 && <button className="btn btn-g btn-sm" onClick={markAllRead}>Mark all read</button>}
          </div>

          {data?.items.length === 0 && <p className="small muted bell-empty">Nothing needs you right now.</p>}

          <div className="bell-list">
            {data?.items.map((item) => (
              <Link className="menu-i bell-item" to={item.href} key={`${item.kind}:${item.id}`} onClick={() => setIsOpen(false)}>
                <span className={`dot ${DOT_FOR_KIND[item.kind]}`} />
                <span className="grow">
                  {item.text}
                  {item.detail && <span className="small muted bell-detail">{item.detail}</span>}
                  <span className="small dim bell-time">{formatDate(item.happenedAt)}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
