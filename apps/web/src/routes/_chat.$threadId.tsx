import { Navigate, createFileRoute } from "@tanstack/react-router";

function LegacyChatThreadRedirect() {
  const { threadId } = Route.useParams();
  return <Navigate to="/draft" search={{ threadId }} replace />;
}

export const Route = createFileRoute("/_chat/$threadId")({
  component: LegacyChatThreadRedirect,
});
