import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getInternalSupabaseEnvironment } from "@/src/config/env/supabase";
import {
  isApiRoute,
  isGuestOnlyAuthRoute,
  isPublicRoute,
  parseSafeToolNext,
} from "../auth/route-policy";
import { resolveRequestId } from "@/src/server/api/request-id";
import { jsonError } from "@/src/server/api/response";

function copySessionCookies(
  response: NextResponse,
  sessionResponse: NextResponse,
) {
  sessionResponse.cookies
    .getAll()
    .forEach((cookie) => response.cookies.set(cookie));
  return response;
}

/**
 * Preserves the requested path in `next` while sending unauthenticated users to login.
 */
function redirectToLogin(
  request: NextRequest,
  sessionResponse: NextResponse,
) {
  const url = request.nextUrl.clone();
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  url.pathname = "/auth/login";
  url.search = "";
  url.searchParams.set("next", parseSafeToolNext(next));

  return copySessionCookies(NextResponse.redirect(url), sessionResponse);
}

function redirectFromGuestOnlyRoute(
  request: NextRequest,
  sessionResponse: NextResponse,
) {
  const destination = parseSafeToolNext(
    request.nextUrl.searchParams.get("next"),
  );
  return copySessionCookies(
    NextResponse.redirect(new URL(destination, request.url)),
    sessionResponse,
  );
}

function apiError(
  request: NextRequest,
  sessionResponse: NextResponse,
  input: { status: number; code: string; message: string },
) {
  const standardResponse = jsonError(
    input,
    resolveRequestId(request),
  );
  const response = new NextResponse(standardResponse.body, {
    status: standardResponse.status,
    statusText: standardResponse.statusText,
    headers: standardResponse.headers,
  });
  return copySessionCookies(response, sessionResponse);
}

/**
 * Middleware helper that refreshes Supabase session cookies and blocks private routes.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;
  let supabaseEnvironment:
    | ReturnType<typeof getInternalSupabaseEnvironment>
    | undefined;
  try {
    supabaseEnvironment = getInternalSupabaseEnvironment();
  } catch {
    supabaseEnvironment = undefined;
  }

  if (!supabaseEnvironment) {
    if (isPublicRoute(pathname)) {
      return supabaseResponse;
    }

    if (isApiRoute(pathname)) {
      return apiError(request, supabaseResponse, {
        status: 503,
        code: "SERVICE_UNAVAILABLE",
        message: "Authentication service unavailable",
      });
    }

    return redirectToLogin(request, supabaseResponse);
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    supabaseEnvironment.url,
    supabaseEnvironment.publishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  const isAuthenticated = Boolean(
    !userError && user && !user.is_anonymous,
  );

  if (!isAuthenticated && !isPublicRoute(pathname)) {
    if (isApiRoute(pathname)) {
      return apiError(request, supabaseResponse, {
        status: 401,
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication required",
      });
    }

    return redirectToLogin(request, supabaseResponse);
  }

  if (isAuthenticated && isGuestOnlyAuthRoute(pathname)) {
    return redirectFromGuestOnlyRoute(request, supabaseResponse);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
