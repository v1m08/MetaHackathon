"use client";
import { useParams } from "next/navigation";
import { PostCard } from "@/components/Post";
import { Shell } from "@/components/Shell";
import { PostSkeleton } from "@/components/ui";
import { useApi } from "@/lib/api";
import type { HydratedPost } from "@/server/db";

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const { data, mutate } = useApi<HydratedPost>(`/api/posts/${id}`);
  return (
    <Shell back title={data ? `${data.author.name.split(" ")[0]}'s post` : "Post"}>
      {data ? <PostCard post={data} onChange={(np) => mutate(np, { revalidate: false })} /> : <PostSkeleton />}
    </Shell>
  );
}
