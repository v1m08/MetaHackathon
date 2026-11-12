"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ComposerScreen } from "@/components/Composer";
import { useApi } from "@/lib/api";

function Inner() {
  const q = useSearchParams();
  const groupId = q.get("group") ?? undefined;
  const { data: group } = useApi<{ name: string }>(groupId ? `/api/groups/${groupId}` : null);
  return <ComposerScreen groupId={groupId} groupName={group?.name} />;
}

export default function ComposePage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
