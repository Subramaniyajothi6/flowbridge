import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "@xyflow/react/dist/style.css";
import "./design-system.css";
import "./app.css";
import { BuilderPage } from "./builder/BuilderPage.tsx";
import { ExecutionDetailPage } from "./pages/ExecutionDetailPage.tsx";
import { ExecutionsPage } from "./pages/ExecutionsPage.tsx";
import { IntegrationsPage } from "./pages/IntegrationsPage.tsx";
import { WorkflowsPage } from "./pages/WorkflowsPage.tsx";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/workflows" replace />} />
        <Route path="/workflows" element={<WorkflowsPage />} />
        <Route path="/workflows/:id" element={<BuilderPage />} />
        <Route path="/executions" element={<ExecutionsPage />} />
        <Route path="/executions/:id" element={<ExecutionDetailPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="*" element={<Navigate to="/workflows" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
