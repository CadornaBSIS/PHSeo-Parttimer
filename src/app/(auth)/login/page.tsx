import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/components/login-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) redirect("/dashboard");

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <Image
          src="/ph-seo-logo.png"
          alt=""
          aria-hidden
          width={1200}
          height={1200}
          className="h-auto w-[min(84vw,980px)] object-contain opacity-[0.13]"
          priority
        />
      </div>
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 sm:px-6 py-10">
        <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start md:items-center">
          <div className="order-2 md:order-1 text-white rounded-2xl p-6 md:p-8 bg-white/5 border border-white/10">
            <div className="space-y-5 text-center md:text-left max-w-xl mx-auto">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold leading-tight">
                PH SEO Workforce Management System
              </h1>
              <p className="text-base sm:text-lg text-slate-300">
                Internal workforce platform for schedules, DTR, time records, and team oversight.
                No public sign-ups. Secure, role-based access with Supabase Auth.
              </p>
              <div className="flex flex-wrap lg:flex-nowrap justify-center md:justify-start gap-2 sm:gap-3 text-sm text-slate-200">
                {["Scheduling", "DTR & time records", "Workforce oversight"].map((label) => (
                  <span
                    key={label}
                    className="whitespace-nowrap px-4 py-2 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="order-1 md:order-2 rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 text-white shadow-xl shadow-black/20">
            <div className="mb-6 space-y-1">
              <p className="text-sm font-medium text-slate-300">Sign in</p>
              <h2 className="text-2xl font-semibold text-white">
                Continue to dashboard
              </h2>
            </div>
            <div className="[&_label]:text-slate-100 [&_input]:bg-white/10 [&_input]:border-white/25 [&_input]:text-white [&_input]:placeholder:text-slate-300 [&_.text-slate-400]:text-slate-300 [&_.text-slate-500]:text-slate-300 [&_.bg-red-50]:bg-red-500/10 [&_.border-red-100]:border-red-300/20 [&_.text-red-600]:text-red-200">
              <LoginForm />
            </div>
            <div className="mt-6 text-xs text-slate-300">
              Need an account? Contact your administrator for access. Public sign-up is disabled.
            </div>
            <div className="mt-4 text-xs text-red-200">
              <Link href="https://supabase.com/docs/guides/auth">
                Supabase Auth secured
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
