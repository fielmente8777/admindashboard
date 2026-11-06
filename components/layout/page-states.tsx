import { CircleAlert, Lock } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-navy">
          {title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function NoAccess() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center">
      <Lock className="size-6 text-muted-foreground" aria-hidden />
      <p className="font-medium">You don&apos;t have access to this page</p>
      <p className="text-sm text-muted-foreground">
        Only super admins can open it. Ask one if you need this.
      </p>
    </div>
  );
}

export function LoadFailed({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center"
    >
      <CircleAlert className="size-6 text-destructive" aria-hidden />
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function TableLoading() {
  return (
    <div role="status" aria-label="Loading" className="space-y-2">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  );
}
