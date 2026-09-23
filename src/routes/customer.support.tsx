import { createFileRoute, Navigate } from "@tanstack/react-router";

// This route duplicated the "Report an issue" flow and had no in-app links to
// it. The canonical flow lives at /report-issue (which also handles resolution
// outcome + handoff), so this route now simply redirects there.
export const Route = createFileRoute("/customer/support")({
  head: () => ({
    meta: [{ title: "Report an issue - DarkOps Care" }],
  }),
  component: () => <Navigate to="/report-issue" replace />,
});
