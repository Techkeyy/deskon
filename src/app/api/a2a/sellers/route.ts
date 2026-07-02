import { NextRequest, NextResponse } from "next/server";
import { listSellers } from "@/lib/db";

/** A2A directory — the closers a visiting agent can negotiate with. */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const sellers = await listSellers();

  return NextResponse.json(
    {
      count: sellers.length,
      sellers: sellers.map((s) => ({
        slug: s.slug,
        name: s.displayName,
        services: s.services.map((svc) => svc.name),
        card: `${origin}/api/a2a/sellers/${s.slug}`,
      })),
    },
    { headers: { "Access-Control-Allow-Origin": "*" } }
  );
}
