import { listUsersForAdmin } from "@/lib/users/admin";
import { UserRowActions } from "@/components/admin/user-actions";
import { Badge, Empty, PageHeading, Panel, TableWrap } from "@/components/admin/ui";
import { formatManilaDate } from "@/lib/format";
import type { UserProfile } from "@/lib/types";

export default async function AdminUsersPage() {
  const { pending, active, suspended, activeAdminCount } = await listUsersForAdmin();

  return (
    <>
      <PageHeading
        title="Accounts"
        sub="FLARE is restricted to authorized BFP personnel. A new registration stays inert until it is approved here."
      />

      <Panel
        title={`Waiting for approval (${pending.length})`}
        action={pending.length > 0 ? <Badge tone="warning">Action needed</Badge> : undefined}
      >
        {pending.length === 0 ? (
          <Empty>Nothing waiting. New registrations appear here.</Empty>
        ) : (
          <UserTable users={pending} showRegistered />
        )}
      </Panel>

      <Panel
        title={`Active (${active.length})`}
        action={<Badge>{activeAdminCount} administrator{activeAdminCount === 1 ? "" : "s"}</Badge>}
      >
        {active.length === 0 ? <Empty>No active accounts.</Empty> : <UserTable users={active} />}
      </Panel>

      <Panel title={`Suspended (${suspended.length})`}>
        {suspended.length === 0 ? (
          <Empty>No suspended accounts.</Empty>
        ) : (
          <UserTable users={suspended} />
        )}
      </Panel>
    </>
  );
}

function UserTable({ users, showRegistered = false }: { users: UserProfile[]; showRegistered?: boolean }) {
  return (
    <TableWrap>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <Th>Name</Th>
            <Th>Rank / Position</Th>
            <Th>Badge</Th>
            <Th>Unit</Th>
            <Th>Email</Th>
            {showRegistered && <Th>Registered</Th>}
            <Th>Role</Th>
            <th className="px-4 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.uid} className="border-b border-border last:border-0 align-middle">
              {/* A name and a badge number are single values: breaking either
                  across lines makes the table harder to scan, not narrower. */}
              <Td className="whitespace-nowrap">
                <span className="font-medium">{user.fullName || user.username}</span>
              </Td>
              <Td>
                {user.rank || "—"}
                {user.position ? <span className="text-muted"> · {user.position}</span> : null}
              </Td>
              <Td className="whitespace-nowrap tabular-nums">{user.badgeNumber || "—"}</Td>
              <Td>{user.unit || "—"}</Td>
              <Td className="text-muted">{user.email}</Td>
              {showRegistered && <Td className="text-muted">{formatManilaDate(user.createdAt)}</Td>}
              <Td>
                {user.role === "admin" ? <Badge tone="success">Admin</Badge> : <Badge>Learner</Badge>}
              </Td>
              <td className="px-4 py-2.5 text-right">
                <UserRowActions uid={user.uid} status={user.status} role={user.role} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-4 py-2 font-medium">{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2.5 ${className}`}>{children}</td>;
}
