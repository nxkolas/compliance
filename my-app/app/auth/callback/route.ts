import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next") ?? "/tool/organizations";
  const next =
    requestedNext.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/tool/organizations";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/error?code=AUTH_CODE_MISSING`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/error?code=AUTH_CALLBACK_FAILED`,
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
