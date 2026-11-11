"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CircleAlert,
  LoaderCircle,
  MoreHorizontal,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  LoadFailed,
  NoAccess,
  PageHeader,
  TableLoading,
} from "@/components/layout/page-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { teamApi, type TeamMember } from "@/lib/api/team-api";
import { formatDateTime } from "@/lib/format";
import { useAuthStore } from "@/stores/auth-store";

import { MemberDialog } from "./member-dialog";

/** The dialog open on this page, if any. */
type OpenDialog =
  { kind: "add" } | { kind: "edit" | "disable"; member: TeamMember } | null;

function accessSummary({
  role,
  advancedPermissions,
  assignedProperties,
}: TeamMember): string {
  if (role === "super_admin") return "Everything";
  const properties = `${assignedProperties.length} ${assignedProperties.length === 1 ? "property" : "properties"}`;
  const extras = advancedPermissions.length;
  return extras > 0
    ? `${properties}, ${extras} extra permission${extras === 1 ? "" : "s"}`
    : properties;
}

function StatusBadge({ member }: { member: TeamMember }) {
  if (member.status === "disabled")
    return <Badge variant="destructive">Disabled</Badge>;
  if (!member.googleLinked)
    return <Badge variant="outline">Not signed in yet</Badge>;
  return <Badge variant="secondary">Active</Badge>;
}

function useSetStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      member,
      status,
    }: {
      member: TeamMember;
      status: TeamMember["status"];
    }) => teamApi.update(member.id, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["team"] });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}

function DisableDialog({
  member,
  onClose,
}: {
  member: TeamMember;
  onClose: () => void;
}) {
  const setStatus = useSetStatus();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disable {member.name ?? member.email}?</DialogTitle>
          <DialogDescription>
            They are signed out everywhere straight away and can&apos;t sign in.
            You can turn their access back on later.
          </DialogDescription>
        </DialogHeader>
        {setStatus.error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {setStatus.error.message}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={setStatus.isPending}
            onClick={() =>
              setStatus.mutate(
                { member, status: "disabled" },
                {
                  onSuccess: () => {
                    toast.success(`Disabled ${member.email}`);
                    onClose();
                  },
                },
              )
            }
          >
            {setStatus.isPending && (
              <LoaderCircle
                data-icon="inline-start"
                className="animate-spin"
                aria-hidden
              />
            )}
            Disable access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemberRow({
  member,
  onOpen,
}: {
  member: TeamMember;
  onOpen: (dialog: OpenDialog) => void;
}) {
  const isSelf = useAuthStore((state) => state.user?.id) === member.id;
  const setStatus = useSetStatus();

  const resend = useMutation({
    mutationFn: () => teamApi.resendInvite(member.id),
    onSuccess: (result) =>
      result.inviteSent
        ? toast.success(`Invite emailed to ${member.email}`)
        : toast.error("The invite email could not be sent. Check the mail server and try again."),
    onError: (error) => toast.error(error.message),
  });

  const enable = () =>
    setStatus.mutate(
      { member, status: "active" },
      {
        onSuccess: () => toast.success(`${member.email} can sign in again`),
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <TableRow
      className={
        member.status === "disabled" ? "text-muted-foreground" : undefined
      }
    >
      <TableCell>
        <div className="font-medium">
          {member.name ?? member.email}
          {isSelf && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              (you)
            </span>
          )}
        </div>
        {member.name && (
          <div className="text-xs text-muted-foreground">{member.email}</div>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={member.role === "super_admin" ? "default" : "outline"}>
          {member.role === "super_admin" ? "Super admin" : "Admin"}
        </Badge>
      </TableCell>
      <TableCell className="text-sm">{accessSummary(member)}</TableCell>
      <TableCell>
        <StatusBadge member={member} />
      </TableCell>
      <TableCell className="text-sm whitespace-nowrap">
        {member.lastLoginAt ? formatDateTime(member.lastLoginAt) : "Never"}
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Actions for ${member.email}`}
              >
                <MoreHorizontal aria-hidden />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onOpen({ kind: "edit", member })}>
              Edit
            </DropdownMenuItem>
            {member.status === "active" && !member.googleLinked && (
              <DropdownMenuItem disabled={resend.isPending} onClick={() => resend.mutate()}>
                Resend invite
              </DropdownMenuItem>
            )}
            {!isSelf &&
              (member.status === "active" ? (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onOpen({ kind: "disable", member })}
                >
                  Disable access
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={enable}>
                  Turn access back on
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

export function TeamPage() {
  const canManage = useAuthStore((state) =>
    state.user?.permissions.includes("team.manage"),
  );
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const team = useQuery({
    queryKey: ["team"],
    queryFn: () => teamApi.list(),
    enabled: canManage,
  });
  const close = () => setDialog(null);

  if (!canManage) return <NoAccess />;

  const activeSuperAdmins =
    team.data?.filter((m) => m.role === "super_admin" && m.status === "active")
      .length ?? 0;

  return (
    <>
      <PageHeader
        title="Team"
        description="Who can use this console and what they can do. Nobody can sign up on their own."
        action={
          <Button onClick={() => setDialog({ kind: "add" })}>
            <UserPlus data-icon="inline-start" aria-hidden />
            Add staff member
          </Button>
        }
      />

      {team.data && activeSuperAdmins < 2 && (
        <p
          role="status"
          className="mb-4 flex items-start gap-2 rounded-lg border border-brand-orange/30 bg-brand-orange/10 px-3 py-2 text-sm"
        >
          <CircleAlert
            className="mt-0.5 size-4 shrink-0 text-brand-orange"
            aria-hidden
          />
          You are the only super admin. Add a second one so the team isn&apos;t
          locked out if you lose access.
        </p>
      )}

      {team.isPending && <TableLoading />}
      {team.error && (
        <LoadFailed error={team.error} onRetry={() => void team.refetch()} />
      )}
      {team.data && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.data.map((member) => (
                <MemberRow key={member.id} member={member} onOpen={setDialog} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {dialog?.kind === "add" && <MemberDialog member={null} onClose={close} />}
      {dialog?.kind === "edit" && (
        <MemberDialog member={dialog.member} onClose={close} />
      )}
      {dialog?.kind === "disable" && (
        <DisableDialog member={dialog.member} onClose={close} />
      )}
    </>
  );
}
