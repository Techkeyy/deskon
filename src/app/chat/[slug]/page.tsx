"use client";

import { use } from "react";
import ChatWindow from "@/components/ChatWindow";

export default function ChatPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  // Seller name will be fetched from the API on first message.
  // For now, derive a display name from the slug.
  const displayName = slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " ");

  return <ChatWindow slug={slug} sellerName={displayName} />;
}
