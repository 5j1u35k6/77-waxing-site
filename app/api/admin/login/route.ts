import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const password = process.env.ADMIN_PASSWORD;
  const sessionToken = process.env.ADMIN_SESSION_TOKEN;
  if (!password || !sessionToken) return NextResponse.redirect(new URL("/admin/login?setup=1", request.url), 303);
  const form = await request.formData();
  if (form.get("password") !== password) return NextResponse.redirect(new URL("/admin/login?error=1", request.url), 303);
  const response = NextResponse.redirect(new URL("/admin", request.url), 303);
  response.cookies.set("admin_session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
