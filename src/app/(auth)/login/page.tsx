import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
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
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="text-white rounded-2xl p-6">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-accent" />
                <span>Manager-provisioned access only</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-semibold leading-tight">
                PH SEO Parttimer
              </h1>
              <p className="text-lg text-slate-300">
                Internal scheduling & DTR platform for managers and employees. No
                public sign-ups. Secure, role-based access with Supabase Auth.
              </p>
              <div className="flex gap-3 text-sm text-slate-300">
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
                  Scheduling
                </span>
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
                  DTR & PDF exports
                </span>
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
                  Manager monitoring
                </span>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-white">
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
              Need an account? Ask a manager to provision one via Employee
              Management. Public sign-up is disabled.
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
