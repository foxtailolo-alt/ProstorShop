import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  attributionCookieName,
  buildAttributionSnapshot,
  parseAttributionCookie,
} from "./lib/attribution";

function hasTrackedParams(searchParams: URLSearchParams) {
  return ["source", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "yclid"].some((key) =>
    searchParams.has(key),
  );
}

export function middleware(request: NextRequest) {
  if (!hasTrackedParams(request.nextUrl.searchParams)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const existing = parseAttributionCookie(request.cookies.get(attributionCookieName)?.value);
  const snapshot = buildAttributionSnapshot(request.nextUrl.searchParams, request.nextUrl.pathname, existing);

  if (!snapshot) {
    return response;
  }

  response.cookies.set(attributionCookieName, JSON.stringify(snapshot), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};