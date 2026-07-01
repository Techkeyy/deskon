import ChatWindow from "@/components/ChatWindow";
import { getSellerBySlug, seedDemoSeller } from "@/lib/db";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (slug === "demo") await seedDemoSeller();
  const seller = await getSellerBySlug(slug);

  const displayName =
    seller?.displayName ??
    slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " ");

  return <ChatWindow slug={slug} sellerName={displayName} />;
}
