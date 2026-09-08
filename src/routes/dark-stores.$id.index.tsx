import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dark-stores/$id/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/dark-stores/$id/"!</div>;
}
