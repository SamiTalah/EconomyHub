import { ConnectorDashboard } from "@/components/admin/connector-dashboard";

export const dynamic = "force-dynamic";

export default function ConnectorsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-10">
      <h1 className="text-2xl font-bold">API-kopplingar</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Hämta priser direkt från butikernas e-handel
      </p>
      <div className="mt-6">
        <ConnectorDashboard />
      </div>
    </div>
  );
}
