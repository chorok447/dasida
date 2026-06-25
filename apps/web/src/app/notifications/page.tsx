import { apiGet } from "@/lib/api";
import type { Notification } from "@/data/notifications";
import NotificationsClient from "./notifications-client";

export default async function NotificationsPage() {
  const notifications = await apiGet<Notification[]>("/api/notifications");
  return <NotificationsClient notifications={notifications} />;
}
