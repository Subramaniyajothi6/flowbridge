import { Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.ts";
import { useAuth } from "../auth.tsx";
import { PageHead, Shell } from "../components/Shell.tsx";
import type { Definition, TeamTemplate, TemplateCategory } from "../types.ts";
import { useLoad } from "../useLoad.ts";
import { templates, withConnections } from "./templates.ts";

const CATEGORIES: TemplateCategory[] = ["Sales", "Finance", "Support", "Operations"];
const FILTERS = ["All", ...CATEGORIES, "Team"];

// Built-in and team templates are shown the same way on this page.
type Card = {
  key: string;
  name: string;
  category: TemplateCategory;
  description: string;
  stepLabels: string[];
  definition: Definition;
  team?: TeamTemplate;
};

const MOST_LABELS = 5;

function teamCard(template: TeamTemplate): Card {
  return {
    key: `team:${template.id}`,
    name: template.name,
    category: template.category,
    description: template.description,
    stepLabels: template.definition.steps.slice(0, MOST_LABELS).map((step) => step.name),
    definition: template.definition,
    team: template,
  };
}

export function TemplatesPage() {
  const navigate = useNavigate();
  const { session, can } = useAuth();
  const connections = useLoad(api.listConnections);
  const team = useLoad(api.listTeamTemplates);
  const [filter, setFilter] = useState("All");
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [toDelete, setToDelete] = useState<TeamTemplate | null>(null);

  const cards: Card[] = [
    ...(team.data ?? []).map(teamCard),
    ...templates.map((template) => ({ key: template.id, name: template.name, category: template.category, description: template.description, stepLabels: template.stepLabels, definition: template.definition })),
  ];
  const visible = cards.filter((card) => filter === "All" || (filter === "Team" ? card.team : card.category === filter));

  const canDelete = (template: TeamTemplate) => template.createdById === session?.user.id || can("members.manage");

  async function useTemplate(card: Card) {
    setProblem(null);
    try {
      const workflow = await api.createWorkflow(card.name, withConnections(card.definition, connections.data ?? []), card.description);
      navigate(`/workflows/${workflow.id}`);
    } catch (error) {
      setProblem((error as Error).message);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await api.deleteTemplate(toDelete.id);
      setNotice(`Deleted "${toDelete.name}".`);
      await team.reload();
    } catch (error) {
      setProblem((error as Error).message);
    }
    setToDelete(null);
  }

  return (
    <Shell>
      <div className="page">
        <PageHead title="Templates" subtitle="Ready-made workflows for common processes, and ones your team has saved. Each one opens in the builder for you to connect your apps and adjust.">
          <Link className="btn" to="/workflows">Start from scratch</Link>
          <button className="btn btn-p" onClick={() => { setNotice(null); setIsCreating(true); }}><Plus size={15} aria-hidden="true" /> Create template</button>
        </PageHead>

        <div className="row wrap" role="group" aria-label="Filter templates">
          {FILTERS.map((item) => (
            <button key={item} className={`chip ${filter === item ? "is-on" : ""}`} aria-pressed={filter === item} onClick={() => setFilter(item)}>
              {item === "Team" ? "Made by your team" : item}
            </button>
          ))}
        </div>

        <div role="status">{notice && <div className="notice ok">{notice}</div>}</div>
        {problem && <div className="notice err" role="alert">{problem}</div>}
        {team.error && <div className="notice err">{team.error}</div>}

        {filter === "Team" && visible.length === 0 && (
          <div className="card">
            <div className="empty">
              <strong>No team templates yet</strong>
              <p className="muted">Turn one of your workflows into a template, so others can start from it.</p>
              <button className="btn btn-p" onClick={() => setIsCreating(true)}>Create template</button>
            </div>
          </div>
        )}

        <div className="g-auto">
          {visible.map((card) => (
            <article className="card int-card" key={card.key}>
              <div>
                <h2 className="strong int-name">{card.name}</h2>
                <div className="small muted">{card.category}{card.team && ` · Made by ${card.team.createdByName}`}</div>
              </div>
              <p className="small muted int-desc">{card.description || "No description."}</p>
              <div className="row wrap template-steps">
                {card.stepLabels.map((label, index) => <span className="badge b-off" key={`${label}-${index}`}>{label}</span>)}
              </div>
              <div className="row between int-foot">
                <span className="small dim">{card.definition.steps.length} {card.definition.steps.length === 1 ? "step" : "steps"}</span>
                <div className="row">
                  {card.team && canDelete(card.team) && (
                    <button className="btn btn-g btn-ic btn-sm" aria-label={`Delete template ${card.name}`} title="Delete template" onClick={() => setToDelete(card.team ?? null)}>
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  )}
                  <button className="btn btn-sm" onClick={() => useTemplate(card)}>Use template</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {isCreating && (
        <CreateTemplateDialog
          onClose={() => setIsCreating(false)}
          onCreated={async (name) => {
            setIsCreating(false);
            setNotice(`Saved "${name}" as a template. Everyone who builds workflows can now use it.`);
            setFilter("Team");
            await team.reload();
          }}
        />
      )}

      {toDelete && (
        <div className="scrim">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Delete template">
            <h2>Delete "{toDelete.name}"?</h2>
            <p className="muted">Workflows already made from it are not changed. This cannot be undone.</p>
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

function CreateTemplateDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (name: string) => Promise<void> }) {
  const workflows = useLoad(api.listWorkflows);
  const [workflowId, setWorkflowId] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("Operations");
  const [description, setDescription] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Only workflows with steps can become templates.
  const choices = (workflows.data ?? []).filter((workflow) => workflow.stepCount > 0);

  // Choosing a workflow fills in its name and description, which can then be changed.
  function chooseWorkflow(id: string) {
    setWorkflowId(id);
    const workflow = choices.find((item) => item.id === id);
    if (workflow) {
      setName(workflow.name);
      setDescription(workflow.description ?? "");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    try {
      await api.createTemplate({ workflowId, name: name.trim(), category, description: description.trim() });
      await onCreated(name.trim());
    } catch (error) {
      setProblem((error as Error).message);
      setIsSaving(false);
    }
  }

  return (
    <div className="scrim">
      <form className="modal" role="dialog" aria-modal="true" aria-label="Create template" onSubmit={submit}>
        <h2>Create template</h2>
        <p className="muted">Saves a copy of a workflow's steps for others to start from. The accounts it uses are left out, so each person chooses their own.</p>

        <div className="field">
          <label className="label" htmlFor="template-workflow">Workflow to copy</label>
          <select id="template-workflow" className="select" required value={workflowId} onChange={(event) => chooseWorkflow(event.target.value)}>
            <option value="" disabled>{workflows.loading ? "Loading workflows..." : "Choose a workflow"}</option>
            {choices.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name} ({workflow.stepCount} {workflow.stepCount === 1 ? "step" : "steps"})</option>)}
          </select>
          <span className="hint">Uses its latest saved draft, or what is published if there is no draft.</span>
        </div>
        <div className="field">
          <label className="label" htmlFor="template-name">Template name</label>
          <input id="template-name" className="input" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="template-category">Team</label>
          <select id="template-category" className="select" value={category} onChange={(event) => setCategory(event.target.value as TemplateCategory)}>
            {CATEGORIES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="template-description">What it does (optional)</label>
          <textarea id="template-description" className="input area" rows={3} maxLength={300} value={description} onChange={(event) => setDescription(event.target.value)} />
        </div>

        {problem && <p className="err-msg">{problem}</p>}
        <div className="modal-a">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-p" disabled={isSaving || !workflowId || !name.trim()}>{isSaving ? "Saving..." : "Save template"}</button>
        </div>
      </form>
    </div>
  );
}
