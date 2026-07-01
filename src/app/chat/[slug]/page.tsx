import ChatWindow from "@/components/ChatWindow";
import { getSellerBySlug } from "@/lib/db";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const seller = await getSellerBySlug(slug);

  const displayName =
    seller?.displayName ??
    slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " ");

  return <ChatWindow slug={slug} sellerName={displayName} />;
}
