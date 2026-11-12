import { Play, Plus, Search, Trash2, Workflow as WorkflowIcon } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.ts";
import { useAuth } from "../auth.tsx";
import { DesignIcon } from "../components/DesignIcon.tsx";
import { Pager } from "../components/Pager.tsx";
import { RunWorkflowDialog } from "../components/RunWorkflowDialog.tsx";
import { PageHead, Shell } from "../components/Shell.tsx";
import { useDismiss } from "../components/useDismiss.ts";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { formatDate, formatNumber, formatPercent, formatRelative } from "../format.ts";
import type { PublicationStatus, WorkflowSummary } from "../types.ts";
import { useLoad } from "../useLoad.ts";

const statusFilters = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
];

// Live runs come first. A workflow that has only been tested says so, instead of "Never run".
function LastRun({ workflow }: { workflow: WorkflowSummary }) {
  if (workflow.lastRun) return <StatusBadge status={workflow.lastRun.status} />;
  if (!workflow.lastTestRun) return <span className="dim">Never run</span>;
  return (
    <span className="row">
      <StatusBadge status={workflow.lastTestRun.status} />
      <span className="small dim">Test only</span>
    </span>
  );
}

function PublicationBadge({ workflow }: { workflow: WorkflowSummary }) {
  const labels: Record<PublicationStatus, { className: string; text: string }> = {
    draft: { className: "b-off", text: "Draft" },
    published: { className: "b-ok", text: `Published, Version ${workflow.versionNumber}` },
    published_with_edits: { className: "b-warn", text: `Version ${workflow.versionNumber}, draft edited` },
  };
  const { className, text } = labels[workflow.status];
  return <span className={`badge ${className}`}>{text}</span>;
}

type SortOrder = "updated" | "name" | "runs" | "rate";
type Layout = "list" | "grid";

const PAGE_SIZE = 10;
const LAYOUT_KEY = "flowbridge.workflowsLayout";

function successRate(workflow: WorkflowSummary): number | null {
  const finished = workflow.last30Days.succeeded + workflow.last30Days.failed;
  return finished === 0 ? null : workflow.last30Days.succeeded / finished;
}

// Workflows with no finished runs have no rate, so they go last when sorting by rate.
const compare: Record<SortOrder, (first: WorkflowSummary, second: WorkflowSummary) => number> = {
  updated: (first, second) => second.updatedAt.localeCompare(first.updatedAt),
  name: (first, second) => first.name.localeCompare(second.name),
  runs: (first, second) => second.last30Days.total - first.last30Days.total,
  rate: (first, second) => (successRate(first) ?? 2) - (successRate(second) ?? 2),
};

// The chosen layout is remembered in this browser only. It is a convenience, so it is fine if it is lost.
function savedLayout(): Layout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

function saveLayout(layout: Layout) {
  try {
    localStorage.setItem(LAYOUT_KEY, layout);
  } catch {
    // Storage can be blocked, for example in a private window. The layout then resets next visit.
  }
}

export function WorkflowsPage() {
  const { can } = useAuth();
  const { data: workflows, error, loading, reload } = useLoad(api.listWorkflows);
  const [isCreating, setIsCreating] = useState(false);
  const [toDelete, setToDelete] = useState<WorkflowSummary | null>(null);
  const [toRun, setToRun] = useState<WorkflowSummary | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("updated");
  const [layout, setLayout] = useState<Layout>(savedLayout);
  const [page, setPage] = useState(1);

  const canEdit = can("workflows.edit");
  const canOpenBuilder = can("builder.view");
  const canRun = can("workflows.run");

  const matching = (workflows ?? [])
    .filter((workflow) => {
      const matchesSearch = workflow.name.toLowerCase().includes(search.trim().toLowerCase());
      const matchesStatus = status === "all" || (status === "draft" ? workflow.status === "draft" : workflow.status !== "draft");
      return matchesSearch && matchesStatus;
    })
    .sort(compare[sortOrder]);

  // Deleting the last workflow on the last page would otherwise leave an empty page.
  const pageCount = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = matching.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function changeLayout(next: Layout) {
    setLayout(next);
    saveLayout(next);
  }

  const actions: CardActions = { canEdit, canOpenBuilder, canRun, run: setToRun, remove: setToDelete };

  async function confirmDelete() {
    if (!toDelete) return;
    await api.deleteWorkflow(toDelete.id);
    setToDelete(null);
    await reload();
  }

  return (
    <Shell>
      <div className="page">
        <PageHead title="Workflows" subtitle="Every automation in your workspace, with how each one is performing.">
          {canEdit && (
            <button className="btn btn-p" onClick={() => setIsCreating(true)}>
              <Plus size={15} aria-hidden="true" /> Create workflow
            </button>
          )}
        </PageHead>

        {error && <div className="notice err">{error}</div>}

        <div className="row wrap">
          <div className="list-search">
            <span className="search-ic"><Search size={14} aria-hidden="true" /></span>
            <input className="input" type="search" aria-label="Search workflows" placeholder="Search workflows" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          </div>
          {/* Only people who edit workflows see drafts, so only they need this filter. */}
          {canEdit && (
            <div className="row wrap" role="group" aria-label="Filter by status">
              {statusFilters.map((filter) => (
                <button key={filter.value} className={`chip ${status === filter.value ? "is-on" : ""}`} aria-pressed={status === filter.value} onClick={() => { setStatus(filter.value); setPage(1); }}>{filter.label}</button>
              ))}
            </div>
          )}
          <div className="grow" />
          <label className="small muted" htmlFor="workflow-sort">Sort by</label>
          <select id="workflow-sort" className="select workflow-sort" value={sortOrder} onChange={(event) => { setSortOrder(event.target.value as SortOrder); setPage(1); }}>
            <option value="updated">Last updated</option>
            <option value="name">Name</option>
            <option value="runs">Most runs</option>
            <option value="rate">Lowest success rate</option>
          </select>
          <div className="seg-ctl hide-m" role="group" aria-label="Layout">
            <button className={layout === "list" ? "is-on" : ""} aria-label="List view" aria-pressed={layout === "list"} onClick={() => changeLayout("list")}><DesignIcon name="list" size={15} /></button>
            <button className={layout === "grid" ? "is-on" : ""} aria-label="Grid view" aria-pressed={layout === "grid"} onClick={() => changeLayout("grid")}><DesignIcon name="grid" size={15} /></button>
          </div>
        </div>

        {!loading && visible.length > 0 && layout === "grid" ? (
          <div className="g-auto">
            {visible.map((workflow) => <WorkflowCard key={workflow.id} workflow={workflow} actions={actions} />)}
          </div>
        ) : (
        <div className="card">
          {loading ? (
            <div className="card-b"><span className="skel" /></div>
          ) : visible.length > 0 ? (
            <div className="tbl-wrap tbl-round">
              <table className="tbl">
                <thead>
                  <tr><th>Workflow</th><th>Status</th><th>Last run</th><th className="r hide-m">Success rate</th><th className="r hide-m">Live runs, 30 days</th><th className="hide-m">Last updated</th><th><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody>
                  {visible.map((workflow) => (
                    <tr key={workflow.id}>
                      <td>
                        {canOpenBuilder ? <Link className="link-row" to={`/workflows/${workflow.id}`}>{workflow.name}</Link> : <span className="strong">{workflow.name}</span>}
                        <div className="small muted">{workflow.stepCount} {workflow.stepCount === 1 ? "step" : "steps"}</div>
                      </td>
                      <td><PublicationBadge workflow={workflow} /></td>
                      <td><LastRun workflow={workflow} /></td>
                      <td className="r num hide-m">{formatPercent(workflow.last30Days.succeeded, workflow.last30Days.succeeded + workflow.last30Days.failed)}</td>
                      <td className="r num hide-m">{formatNumber(workflow.last30Days.total)}</td>
                      <td className="muted hide-m">
                        {formatDate(workflow.updatedAt)}
                        {workflow.updatedBy && <div className="small dim">{workflow.updatedBy}</div>}
                      </td>
                      <td className="r">
                        <div className="row team-actions">
                          {can("workflows.run") && workflow.status !== "draft" && (
                            <button className="btn btn-sm" onClick={() => setToRun(workflow)}><Play size={13} aria-hidden="true" /> Run</button>
                          )}
                          {canEdit && (
                            <button className="btn btn-g btn-ic btn-sm" aria-label={`Delete ${workflow.name}`} onClick={() => setToDelete(workflow)}>
                              <Trash2 size={14} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">
              <span className="empty-ic"><WorkflowIcon size={20} aria-hidden="true" /></span>
              <strong>{workflows?.length ? "No workflows match" : "No workflows yet"}</strong>
              <p className="muted">{workflows?.length ? "Try a different search or filter." : canEdit ? "Create your first workflow to start automating." : "Workflows will appear here once they are created."}</p>
              {canEdit && !workflows?.length && <button className="btn btn-p" onClick={() => setIsCreating(true)}>Create workflow</button>}
            </div>
          )}
        </div>
        )}

        {!loading && <Pager page={currentPage} pageSize={PAGE_SIZE} total={matching.length} onChange={(number) => { setPage(number); window.scrollTo({ top: 0 }); }} />}
      </div>

      {isCreating && <CreateWorkflowDialog onClose={() => setIsCreating(false)} />}
      {toRun && <RunWorkflowDialog workflow={toRun} onClose={() => setToRun(null)} />}

      {toDelete && (
        <div className="scrim">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Delete workflow">
            <h2>Delete "{toDelete.name}"?</h2>
            <p className="muted">This also deletes its run history and triggers. It cannot be undone.</p>
            <div className="modal-a">
              <button className="btn" onClick={() => setToDelete(null)}>Cancel</button>
              <button className="btn btn-d" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

type CardActions = {
  canEdit: boolean;
  canOpenBuilder: boolean;
  canRun: boolean;
  run: (workflow: WorkflowSummary) => void;
  remove: (workflow: WorkflowSummary) => void;
};

const cardBadges: Record<PublicationStatus, { className: string; dot: string; text: string }> = {
  draft: { className: "b-off", dot: "", text: "Draft" },
  published: { className: "b-ok", dot: "ok", text: "Published" },
  published_with_edits: { className: "b-warn", dot: "warn", text: "Published, draft edited" },
};

// The description, or a summary of the steps when no description was written.
function describeWorkflow(workflow: WorkflowSummary): string {
  if (workflow.description) return workflow.description;
  // Two steps can share a name, such as two "Send message" steps. Each name is said once.
  const names = [...new Set(workflow.stepNames)];
  if (names.length === 0) return "No steps yet.";
  const shown = names.slice(0, 3);
  const rest = names.length - shown.length;
  if (rest > 0) return `Runs ${shown.join(", ")} and ${rest} more ${rest === 1 ? "step" : "steps"}.`;
  if (shown.length === 1) return `Runs ${shown[0]}.`;
  return `Runs ${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}.`;
}

// When it last ran and, if that run did not simply succeed, how it went: "2 min ago, failed".
// A workflow that has only been tested says so.
function lastRunLabel(workflow: WorkflowSummary): string {
  const run = workflow.lastRun ?? workflow.lastTestRun;
  if (!run) return "Never run";
  if (run.status === "running" || run.status === "queued") return "Running now";

  const notes = [];
  if (run.status === "failed") notes.push("failed");
  if (run.status === "waiting") notes.push("waiting");
  if (!workflow.lastRun) notes.push("test");
  return [formatRelative(run.createdAt), ...notes].join(", ");
}

// One workflow in the grid layout, as the design draws it.
function WorkflowCard({ workflow, actions }: { workflow: WorkflowSummary; actions: CardActions }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuBox = useRef<HTMLDivElement>(null);
  useDismiss(menuBox, isMenuOpen, () => setIsMenuOpen(false));

  const canRunThis = actions.canRun && workflow.status !== "draft";
  const hasMenu = canRunThis || actions.canOpenBuilder || actions.canEdit;
  const rate = successRate(workflow);
  const badge = cardBadges[workflow.status];

  return (
    <article className="card workflow-card">
      <div className="row between workflow-card-top" ref={menuBox}>
        {actions.canOpenBuilder ? <Link className="link-row trunc" to={`/workflows/${workflow.id}`}>{workflow.name}</Link> : <span className="strong trunc">{workflow.name}</span>}
        {hasMenu && (
          <button className="btn btn-g btn-sm btn-ic" aria-label={`Actions for ${workflow.name}`} aria-expanded={isMenuOpen} onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <DesignIcon name="more" size={16} />
          </button>
        )}
        {isMenuOpen && (
          <div className="pop workflow-card-menu" role="menu">
            {canRunThis && (
              <button className="menu-i" role="menuitem" onClick={() => { setIsMenuOpen(false); actions.run(workflow); }}><DesignIcon name="play" /> Run now</button>
            )}
            {actions.canOpenBuilder && (
              <Link className="menu-i" role="menuitem" to={`/workflows/${workflow.id}`}><DesignIcon name="edit" /> {actions.canEdit ? "Open in builder" : "View workflow"}</Link>
            )}
            {actions.canEdit && (
              <button className="menu-i danger" role="menuitem" onClick={() => { setIsMenuOpen(false); actions.remove(workflow); }}><DesignIcon name="trash" /> Delete</button>
            )}
          </div>
        )}
      </div>
      <p className="small muted workflow-card-desc">{describeWorkflow(workflow)}</p>
      <div className="row between">
        <span className={`badge ${badge.className}`}><span className={`dot ${badge.dot}`} />{badge.text}</span>
        <span className="small muted">{lastRunLabel(workflow)}</span>
      </div>
      <div className="row between small workflow-card-foot">
        <span><span className="strong num">{rate === null ? "No runs" : formatPercent(workflow.last30Days.succeeded, workflow.last30Days.succeeded + workflow.last30Days.failed)}</span> <span className="muted">success</span></span>
        <span><span className="strong num">{formatNumber(workflow.last30Days.total)}</span> <span className="muted">{workflow.last30Days.total === 1 ? "run" : "runs"}</span></span>
      </div>
    </article>
  );
}

function CreateWorkflowDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const workflow = await api.createWorkflow(name.trim(), undefined, description.trim());
      navigate(`/workflows/${workflow.id}`);
    } catch (problem) {
      setError((problem as Error).message);
    }
  }

  return (
    <div className="scrim">
      <form className="modal" role="dialog" aria-modal="true" aria-label="New workflow" onSubmit={submit}>
        <h2>New workflow</h2>
        <div className="field">
          <label className="label" htmlFor="workflow-name">Name</label>
          <input id="workflow-name" className="input" value={name} onChange={(event) => setName(event.target.value)} autoFocus required maxLength={120} />
        </div>
        <div className="field">
          <label className="label" htmlFor="workflow-description">Description <span className="dim">(optional)</span></label>
          <textarea id="workflow-description" className="input area" rows={2} placeholder="What does it do? For example: Sends refund requests over a set amount to a manager." value={description} onChange={(event) => setDescription(event.target.value)} maxLength={300} />
        </div>
        {error && <p className="err-msg">{error}</p>}
        <div className="modal-a">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-p" disabled={!name.trim()}>Create</button>
        </div>
      </form>
    </div>
  );
}
