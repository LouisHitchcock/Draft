import { Navigate, createFileRoute } from "@tanstack/react-router";

function ChatIndexRouteView() {
  return <Navigate to="/draft" search={{ threadId: undefined }} replace />;
}

export const Route = createFileRoute("/_chat/")({
  component: ChatIndexRouteView,
});
