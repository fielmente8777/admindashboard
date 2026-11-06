"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ADVANCED_PERMISSIONS,
  teamApi,
  type TeamMember,
} from "@/lib/api/team-api";
import { useAuthStore } from "@/stores/auth-store";

import { PropertyPicker } from "./property-picker";

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super admin" },
];

const propertyCode = z.string().trim().min(1, "Required").max(128);

const memberSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address")),
  name: z.string().trim().max(120),
  role: z.enum(["admin", "super_admin"]),
  advancedPermissions: z.array(
    z.enum(ADVANCED_PERMISSIONS.map(({ id }) => id)),
  ),
  assignedProperties: z.array(
    z.object({ ndid: propertyCode, hid: propertyCode }),
  ),
});

type MemberForm = z.infer<typeof memberSchema>;

/** Adds someone when `member` is null, otherwise edits them. */
export function MemberDialog({
  member,
  onClose,
}: {
  member: TeamMember | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const updateName = useAuthStore((state) => state.updateName);
  const isSelf = member?.id === currentUserId;

  const form = useForm<MemberForm>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      email: member?.email ?? "",
      name: member?.name ?? "",
      role: member?.role ?? "admin",
      advancedPermissions: member?.advancedPermissions ?? [],
      assignedProperties: member?.assignedProperties ?? [],
    },
  });
  const { errors } = form.formState;
  const isSuperAdmin =
    useWatch({ control: form.control, name: "role" }) === "super_admin";

  const save = useMutation({
    mutationFn: ({ email, name, ...access }: MemberForm) => {
      const fields = { ...access, name: name || null };
      return member
        ? teamApi.update(member.id, fields)
        : teamApi.add({ email, ...fields });
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ["team"] });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      if (isSelf) updateName(saved.name);
      toast.success(
        member
          ? `Saved ${saved.email}`
          : `${saved.email} can now sign in with Google`,
      );
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {member
              ? `Edit ${member.name ?? member.email}`
              : "Add a staff member"}
          </DialogTitle>
          <DialogDescription>
            {member
              ? "Changes apply on their very next click."
              : "They sign in with this Google account, then a code sent to this email."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit((values) => save.mutate(values))}
          className="space-y-5"
          noValidate
        >
          <Field data-invalid={Boolean(errors.email)}>
            <FieldLabel htmlFor="member-email">Work email</FieldLabel>
            <Input
              id="member-email"
              type="email"
              autoComplete="off"
              disabled={Boolean(member)}
              aria-invalid={Boolean(errors.email)}
              {...form.register("email")}
            />
            {member && (
              <FieldDescription>
                The email can&apos;t be changed.
              </FieldDescription>
            )}
            <FieldError errors={[errors.email]} />
          </Field>

          <Field data-invalid={Boolean(errors.name)}>
            <FieldLabel htmlFor="member-name">Name</FieldLabel>
            <Input
              id="member-name"
              autoComplete="off"
              aria-invalid={Boolean(errors.name)}
              {...form.register("name")}
            />
            <FieldError errors={[errors.name]} />
          </Field>

          <Field>
            <FieldLabel>Role</FieldLabel>
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <Select
                  items={ROLES}
                  value={field.value}
                  disabled={isSelf}
                  onValueChange={(value) => value && field.onChange(value)}
                >
                  <SelectTrigger className="w-full" aria-label="Role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {isSelf && (
              <FieldDescription>
                Another super admin has to change your role.
              </FieldDescription>
            )}
          </Field>

          {isSuperAdmin ? (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              Super admins have every permission and see every property, and can
              manage the team.
            </p>
          ) : (
            <>
              <FieldSet>
                <FieldLegend variant="label">Advanced permissions</FieldLegend>
                <FieldDescription>
                  Viewing clients, editing profiles and viewing billing come
                  automatically.
                </FieldDescription>
                <Controller
                  control={form.control}
                  name="advancedPermissions"
                  render={({ field }) => (
                    <div className="space-y-2.5">
                      {ADVANCED_PERMISSIONS.map(({ id, label, hint }) => (
                        <label
                          key={id}
                          className="flex cursor-pointer items-start gap-2.5"
                        >
                          <Checkbox
                            className="mt-0.5"
                            checked={field.value.includes(id)}
                            onCheckedChange={(checked) =>
                              field.onChange(
                                checked
                                  ? [...field.value, id]
                                  : field.value.filter((p) => p !== id),
                              )
                            }
                          />
                          <span className="text-sm">
                            <span className="font-medium">{label}</span>
                            <span className="block text-xs text-muted-foreground">
                              {hint}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                />
              </FieldSet>

              <FieldSet>
                <FieldLegend variant="label">Assigned properties</FieldLegend>
                <FieldDescription>
                  They only see these hotels and properties. Several admins can
                  share one.
                </FieldDescription>
                <Controller
                  control={form.control}
                  name="assignedProperties"
                  render={({ field }) => (
                    <PropertyPicker
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </FieldSet>
            </>
          )}

          {save.error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {save.error.message}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && (
                <LoaderCircle
                  data-icon="inline-start"
                  className="animate-spin"
                  aria-hidden
                />
              )}
              {member ? "Save changes" : "Add to team"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
