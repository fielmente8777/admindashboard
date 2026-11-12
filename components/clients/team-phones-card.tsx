"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, LoaderCircle, Pencil } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useCan } from "@/components/billing/billing-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ALERT_COVERAGE_LABEL,
  teamPhonesApi,
  type ClientTeam,
  type TeamMember,
} from "@/lib/api/team-phones-api";

/**
 * The client's dashboard users and their WhatsApp numbers. The hotel's Team management list
 * and its lead-alert picker only offer people with a number, so a missing one means that
 * person can't be chosen for WhatsApp alerts.
 */
export function TeamPhonesCard({ ndid }: { ndid: string }) {
  const queryClient = useQueryClient();
  const canEdit = useCan("clients.edit");
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const team = useQuery({
    queryKey: ["clients", "team-phones", ndid],
    queryFn: () => teamPhonesApi.team(ndid),
  });

  const save = useMutation({
    mutationFn: (input: { member: TeamMember; phone: string; addToAlerts: boolean }) =>
      teamPhonesApi.setPhone(ndid, input.member.id, input.phone, input.addToAlerts),
    onSuccess: (view: ClientTeam, { member, phone }) => {
      queryClient.setQueryData(["clients", "team-phones", ndid], view);
      void queryClient.invalidateQueries({ queryKey: ["clients", "notifications", ndid] });
      void queryClient.invalidateQueries({ queryKey: ["clients", "one", ndid] });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      toast.success(
        phone ? `Saved ${member.name ?? member.email}'s number.` : `Removed ${member.name ?? member.email}'s number.`,
      );
      setEditing(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const missing = team.data?.members.filter((m) => !m.phone).length ?? 0;

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Team &amp; WhatsApp numbers
          {missing > 0 && <Badge variant="destructive">{missing} without a number</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          The people who sign in to this hotel&apos;s dashboard. Someone without a number isn&apos;t shown with one
          in the hotel&apos;s Team management and can&apos;t be picked for WhatsApp lead alerts.
        </p>
        {team.isPending && <Skeleton className="h-24 w-full" />}
        {team.error && <p className="text-sm text-destructive">{team.error.message}</p>}
        {team.data && (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>WhatsApp number</TableHead>
                  <TableHead>Lead alerts</TableHead>
                  {canEdit && <TableHead className="w-24" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.data.members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="font-medium">{member.name ?? "-"}</div>
                      <div className="text-xs text-muted-foreground">{member.email}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {member.isOwner ? (
                        <Badge variant="secondary">Owner</Badge>
                      ) : member.isAdmin ? (
                        "Admin"
                      ) : (
                        "Member"
                      )}
                      {!member.isActive && <div className="text-xs text-muted-foreground">Turned off</div>}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {member.phone ?? (
                        <span className="inline-flex items-center gap-1 font-sans text-destructive">
                          <CircleAlert className="size-3.5" aria-hidden />
                          Missing
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {member.alerts ? ALERT_COVERAGE_LABEL[member.alerts] : "-"}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => setEditing(member)}>
                          <Pencil aria-hidden />
                          {member.phone ? "Edit" : "Add"}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {editing && team.data && (
        <PhoneDialog
          member={editing}
          suggested={editing.isOwner ? team.data.suggestedOwnerPhone : null}
          saving={save.isPending}
          onClose={() => setEditing(null)}
          onSave={(phone, addToAlerts) => save.mutate({ member: editing, phone, addToAlerts })}
        />
      )}
    </Card>
  );
}

function PhoneDialog({
  member,
  suggested,
  saving,
  onClose,
  onSave,
}: {
  member: TeamMember;
  suggested: string | null;
  saving: boolean;
  onClose: () => void;
  onSave: (phone: string, addToAlerts: boolean) => void;
}) {
  const [phone, setPhone] = useState(member.phone ?? suggested ?? "");
  const [addToAlerts, setAddToAlerts] = useState(true);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave(phone.trim(), phone.trim() !== "" && addToAlerts);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{member.phone ? "Change" : "Add"} WhatsApp number</DialogTitle>
            <DialogDescription>
              {member.name ?? member.email}
              {member.isOwner ? " (account holder)" : ""}
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="team-phone">Number with country code</FieldLabel>
            <Input
              id="team-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+91 98765 43210"
              autoFocus
            />
            <FieldDescription>
              {!member.phone && suggested
                ? "Filled in from the hotel's phone. "
                : ""}
              A 10-digit number is saved as Indian (+91). Leave empty to remove it.
            </FieldDescription>
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={addToAlerts}
              onCheckedChange={(on) => setAddToAlerts(Boolean(on))}
              disabled={phone.trim() === ""}
            />
            <span>
              Send this number WhatsApp lead alerts
              <span className="block text-xs text-muted-foreground">
                Adds it to every lead source of the properties you can see. Switches that are off stay off.
              </span>
            </span>
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <LoaderCircle className="animate-spin" aria-hidden />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
