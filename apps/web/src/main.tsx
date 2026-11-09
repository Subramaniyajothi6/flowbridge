import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "@xyflow/react/dist/style.css";
import "./design-system.css";
import "./app.css";
import { AuthProvider, Protected, useAuth } from "./auth.tsx";
import { BuilderPage } from "./builder/BuilderPage.tsx";
import { AnalyticsPage } from "./pages/AnalyticsPage.tsx";
import { DocsPage } from "./pages/DocsPage.tsx";
import { ExecutionDetailPage } from "./pages/ExecutionDetailPage.tsx";
import { ExecutionsPage } from "./pages/ExecutionsPage.tsx";
import { IntegrationsPage } from "./pages/IntegrationsPage.tsx";
import { OverviewPage } from "./pages/OverviewPage.tsx";
import { RegisterPage } from "./pages/RegisterPage.tsx";
import { SettingsPage } from "./pages/SettingsPage.tsx";
import { SignInPage } from "./pages/SignInPage.tsx";
import { TeamPage } from "./pages/TeamPage.tsx";
import { TemplatesPage } from "./pages/TemplatesPage.tsx";
import { WorkflowsPage } from "./pages/WorkflowsPage.tsx";

// The public Home page is served by the server at "/", so this only catches unknown addresses.
function UnknownAddress() {
  const { status, session } = useAuth();
  if (!status) return null;
  return <Navigate to={session ? "/overview" : "/sign-in"} replace />;
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/templates" element={<Protected permission="workflows.edit"><TemplatesPage /></Protected>} />
          <Route path="/overview" element={<Protected><OverviewPage /></Protected>} />
          <Route path="/workflows" element={<Protected permission="workflows.view"><WorkflowsPage /></Protected>} />
          <Route path="/workflows/:id" element={<Protected permission="builder.view"><BuilderPage /></Protected>} />
          <Route path="/executions" element={<Protected permission="runs.view"><ExecutionsPage /></Protected>} />
          <Route path="/executions/:id" element={<Protected permission="runs.view"><ExecutionDetailPage /></Protected>} />
          <Route path="/integrations" element={<Protected permission="integrations.view"><IntegrationsPage /></Protected>} />
          <Route path="/analytics" element={<Protected permission="runs.view"><AnalyticsPage /></Protected>} />
          <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
          <Route path="/team" element={<Protected permission="members.manage"><TeamPage /></Protected>} />
          <Route path="*" element={<UnknownAddress />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
