import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiGetOrNull } from "@/lib/api";
import type { PublicUser } from "@/data/users";
import { UserProfileClient } from "./user-profile-client";

const getUser = cache((id: string) => {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return Promise.resolve(null);
  return apiGetOrNull<PublicUser>(`/api/users/${numericId}`);
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const user = await getUser(id);
  if (!user) return {};
  return {
    title: `${user.name}님의 프로필`,
    description: `${user.name}님이 작성한 업사이클 게시글 ${user.postCount}개`,
  };
}

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(id);
  if (!user) notFound();
  return <UserProfileClient user={user} />;
}
