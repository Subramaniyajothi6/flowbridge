import { useState } from "react";
import { api } from "../api.ts";
import { PageHead, Shell } from "../components/Shell.tsx";
import { HttpIcon, ServiceLogo } from "../components/StepIcon.tsx";
import { formatNumber, formatPercent, formatSeconds } from "../format.ts";
import type { Analytics } from "../types.ts";
import { useLoad } from "../useLoad.ts";

const ranges = [7, 14, 30];

type Day = Analytics["daily"][number];

// The database only returns days that had runs. A chart needs the quiet days as well.
function everyDay(daily: Day[], days: number): Day[] {
  const byDate = new Map(daily.map((day) => [day.day, day]));
  const filled: Day[] = [];
  for (let back = days - 1; back >= 0; back -= 1) {
    const day = new Date(Date.now() - back * 86400 * 1000).toISOString().slice(0, 10);
    filled.push(byDate.get(day) ?? { day, succeeded: 0, failed: 0, average_seconds: 0 });
  }
  return filled;
}

function shortDate(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
}

export function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [showTable, setShowTable] = useState(false);
  const { data, error } = useLoad(() => api.analytics(days), [days]);

  const series = data ? everyDay(data.daily, data.days) : [];
  const finished = data ? data.totals.succeeded + data.totals.failed : 0;

  return (
    <Shell>
      <div className="page">
        <PageHead title="Analytics" subtitle="How reliably your published workflows ran, and where to look when they did not. Test runs are not included.">
          <div className="seg-ctl" role="group" aria-label="Time range">
            {ranges.map((range) => (
              <button key={range} className={days === range ? "is-on" : ""} aria-pressed={days === range} onClick={() => setDays(range)}>Last {range} days</button>
            ))}
          </div>
        </PageHead>

        {error && <div className="notice err">{error}</div>}
        {!data && !error && <span className="skel" />}

        {data && (
          <>
            <section className="card stats" aria-label="Totals">
              <Stat label="Total runs" value={formatNumber(data.totals.total)} detail={`${formatNumber(data.totals.succeeded)} succeeded`} />
              <Stat label="Success rate" value={formatPercent(data.totals.succeeded, finished)} detail="Runs that finished every step" />
              <Stat label="Failure rate" value={formatPercent(data.totals.failed, finished)} detail={`${formatNumber(data.totals.failed)} failed runs`} />
              <Stat label="Average duration" value={finished === 0 ? "-" : formatSeconds(data.totals.average_seconds)} detail="Across all workflows" />
            </section>

            <section className="card">
              <div className="card-h">
                <h2 className="card-t">Execution trend</h2>
                <button className="btn btn-sm btn-g" onClick={() => setShowTable(!showTable)}>{showTable ? "View as chart" : "View as table"}</button>
              </div>
              <div className="card-b col">
                {showTable ? <TrendTable series={series} /> : (
                  <>
                    <DayBars title="Successful runs per day" tone="tall" series={series} valueOf={(day) => day.succeeded} format={formatNumber} />
                    <DayBars title="Failed runs per day" tone="tone-fail" series={series} valueOf={(day) => day.failed} format={formatNumber} />
                    <DayBars title="Average duration per day" tone="tone-time" series={series} valueOf={(day) => day.average_seconds} format={formatSeconds} />
                    <div className="row between small dim num"><span>{shortDate(series[0].day)}</span><span>{shortDate(series[series.length - 1].day)}</span></div>
                  </>
                )}
              </div>
            </section>

            {/* Cards side by side start and end level, like on Overview. */}
            <div className="g-21 overview-rows">
              <section className="card">
                <div className="card-h"><h2 className="card-t">Most active workflows</h2><span className="small dim">Sorted by runs</span></div>
                {data.byWorkflow.length === 0 ? <p className="card-b muted">No live runs in this period.</p> : (
                  <div className="tbl-wrap tbl-round">
                    <table className="tbl">
                      <thead><tr><th>Workflow</th><th className="r">Runs</th><th className="r">Success</th><th className="r hide-m">Failure</th><th className="r hide-m">Avg. duration</th></tr></thead>
                      <tbody>
                        {data.byWorkflow.map((workflow) => (
                          <tr key={workflow.id}>
                            <td className="strong">{workflow.name}</td>
                            <td className="r num">{formatNumber(workflow.runs)}</td>
                            <td className="r num">{formatPercent(workflow.succeeded, workflow.succeeded + workflow.failed)}</td>
                            <td className="r num hide-m">{formatPercent(workflow.failed, workflow.succeeded + workflow.failed)}</td>
                            <td className="r num hide-m">{formatSeconds(workflow.average_seconds)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="card">
                <div className="card-h"><h2 className="card-t">Why runs failed</h2></div>
                <div className="card-b col" style={{ gap: 12 }}>
                  {data.failureReasons.length === 0 && <p className="muted">No failed steps in this period.</p>}
                  {data.failureReasons.map((item) => (
                    <div key={item.reason} title={item.example ? `For example: ${item.example}` : undefined}>
                      <div className="row between small">
                        <span className="strong trunc">{item.reason}</span>
                        <span className="num strong">{formatNumber(item.failures)}</span>
                      </div>
                      <Meter value={item.failures} peak={data.failureReasons[0].failures} tone="tone-fail" />
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="card">
              <div className="card-h"><h2 className="card-t">Integration usage</h2><span className="small dim">Steps run per app</span></div>
              <div className="card-b">
                {data.integrationUsage.length === 0 ? <p className="muted">No app steps ran in this period.</p> : (
                  <div className="usage-grid">
                    {data.integrationUsage.map((item) => (
                      <div className="usage-item" key={item.app}>
                        {item.app === "http_request" ? <HttpIcon /> : <ServiceLogo connector={item.app} />}
                        <div className="grow" style={{ minWidth: 0 }}>
                          <div className="row between small">
                            <span className="trunc">{item.name}</span>
                            <span className="num strong">{formatNumber(item.steps)}</span>
                          </div>
                          <Meter value={item.steps} peak={data.integrationUsage[0].steps} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </Shell>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="stat">
      <span className="stat-l">{label}</span>
      <span className="stat-v">{value}</span>
      <span className="stat-d">{detail}</span>
    </div>
  );
}

// A horizontal bar showing a value against the largest one in its list.
function Meter({ value, peak, tone = "" }: { value: number; peak: number; tone?: string }) {
  return (
    <div className={`meter ${tone}`} aria-hidden="true">
      <i style={{ width: `${peak > 0 ? Math.max(3, (value / peak) * 100) : 0}%` }} />
    </div>
  );
}

// One small chart for each measure, because they have very different scales.
function DayBars({ title, tone, series, valueOf, format }: { title: string; tone: string; series: Day[]; valueOf: (day: Day) => number; format: (value: number) => string }) {
  const peak = Math.max(...series.map(valueOf), 0);

  return (
    <div>
      <div className="row between small"><span className="muted">{title}</span><span className="dim num">Peak {format(peak)}</span></div>
      <div className={`bars day-bars ${tone}`} role="img" aria-label={`${title}. Peak ${format(peak)}. Use View as table for each value.`}>
        {series.map((day) => {
          const value = valueOf(day);
          return (
            <div className="bar-col" key={day.day}>
              {value > 0 && <div className="bar" style={{ height: `${Math.max(4, (value / peak) * 100)}%` }} />}
              <span className="bar-tip"><b>{format(value)}</b> {shortDate(day.day)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrendTable({ series }: { series: Day[] }) {
  return (
    <div className="tbl-wrap trend-table">
      <table className="tbl">
        <thead><tr><th>Day</th><th className="r">Successful</th><th className="r">Failed</th><th className="r">Average duration</th></tr></thead>
        <tbody>
          {series.map((day) => (
            <tr key={day.day}>
              <td>{shortDate(day.day)}</td>
              <td className="r num">{formatNumber(day.succeeded)}</td>
              <td className="r num">{formatNumber(day.failed)}</td>
              <td className="r num">{day.succeeded + day.failed > 0 ? formatSeconds(day.average_seconds) : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
