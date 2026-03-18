import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type CookieSetOptions = Omit<Parameters<NextResponse["cookies"]["set"]>[0], "name" | "value">;

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options?: CookieSetOptions) {
        res.cookies.set({ name, value, ...(options ?? {}) });
      },
      remove(name: string, options?: CookieSetOptions) {
        res.cookies.set({ name, value: "", ...(options ?? {}), maxAge: 0 });
      },
    },
    headers: req.headers,
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const pathname = req.nextUrl.pathname;
  const isAuthRoute = ["/login", "/forgot-password"].includes(pathname);

  if (!session && !isAuthRoute) {
    const redirectUrl = new URL("/login", req.url);
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|auth|api/public).*)",
  ],
};
