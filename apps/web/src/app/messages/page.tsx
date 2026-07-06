import { Suspense } from "react";
import { ConversationListClient } from "./conversation-list";

export default function MessagesPage() {
  return (
    <Suspense>
      <ConversationListClient />
    </Suspense>
  );
}
