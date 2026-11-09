import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.ts";
import { PageHead, Shell } from "../components/Shell.tsx";
import { useLoad } from "../useLoad.ts";
import { templates, withConnections, type Template } from "./templates.ts";

const categories = ["All", "Sales", "Finance", "Support", "Operations"];

export function TemplatesPage() {
  const navigate = useNavigate();
  const connections = useLoad(api.listConnections);
  const [category, setCategory] = useState("All");
  const [problem, setProblem] = useState<string | null>(null);

  const visible = templates.filter((template) => category === "All" || template.category === category);

  async function useTemplate(template: Template) {
    setProblem(null);
    try {
      const workflow = await api.createWorkflow(template.name, withConnections(template.definition, connections.data ?? []));
      navigate(`/workflows/${workflow.id}`);
    } catch (error) {
      setProblem((error as Error).message);
    }
  }

  return (
    <Shell>
      <div className="page">
        <PageHead title="Templates" subtitle="Ready-made workflows for common processes. Each one opens in the builder for you to connect your apps and adjust.">
          <Link className="btn" to="/workflows">Start from scratch</Link>
        </PageHead>

        <div className="row wrap" role="group" aria-label="Filter by team">
          {categories.map((item) => (
            <button key={item} className={`chip ${category === item ? "is-on" : ""}`} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>
          ))}
        </div>

        {problem && <div className="notice err" role="alert">{problem}</div>}

        <div className="g-auto">
          {visible.map((template) => (
            <article className="card int-card" key={template.id}>
              <div>
                <h2 className="strong int-name">{template.name}</h2>
                <div className="small muted">{template.category}</div>
              </div>
              <p className="small muted int-desc">{template.description}</p>
              <div className="row wrap template-steps">
                {template.stepLabels.map((label) => <span className="badge b-off" key={label}>{label}</span>)}
              </div>
              <div className="row between int-foot">
                <span className="small dim">{template.definition.steps.length} steps</span>
                <button className="btn btn-sm" onClick={() => useTemplate(template)}>Use template</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </Shell>
  );
}
