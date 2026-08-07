import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

const applySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  purpose: z.string().trim().min(1).max(200),
});

export type ApplyInviteResult =
  | { status: "ok"; code: string; repeat: boolean }
  | { status: "sold_out" }
  | { status: "rate_limited" };

const MAX_PER_IP_PER_DAY = 5;

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`jimu:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

export const applyForInvite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => applySchema.parse(input))
  .handler(async ({ data }): Promise<ApplyInviteResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let ipHash: string | null = null;
    try {
      const request = getRequest();
      const forwarded = request.headers.get("x-forwarded-for") ?? "";
      const ip =
        forwarded.split(",")[0]?.trim() || request.headers.get("cf-connecting-ip") || "";
      if (ip) ipHash = await hashIp(ip);
    } catch {
      ipHash = null;
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("invite_applications")
      .select("code")
      .eq("email", data.email)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return { status: "ok", code: existing.code, repeat: true };

    if (ipHash) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count, error: countError } = await supabaseAdmin
        .from("invite_applications")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("created_at", since);
      if (countError) throw countError;
      if ((count ?? 0) >= MAX_PER_IP_PER_DAY) return { status: "rate_limited" };
    }

    const { data: code, error } = await supabaseAdmin.rpc("claim_invite_code", {
      _email: data.email,
      _purpose: data.purpose,
      ...(ipHash ? { _ip_hash: ipHash } : {}),
    });
    if (error) throw error;
    if (!code) return { status: "sold_out" };
    return { status: "ok", code, repeat: false };
  });
