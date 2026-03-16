import Link from "next/link";
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center px-6">
      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        <div className="text-white space-y-6">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-accent" />
            <span>Manager-provisioned access only</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold leading-tight">
            ViteSeo Parttimer
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
        <div className="card bg-white/90 backdrop-blur shadow-2xl border border-white/60 rounded-2xl p-8">
          <div className="mb-6 space-y-1">
            <p className="text-sm font-medium text-slate-500">Sign in</p>
            <h2 className="text-2xl font-semibold text-slate-900">
              Continue to dashboard
            </h2>
          </div>
          <LoginForm />
          <div className="mt-6 text-xs text-slate-400">
            Need an account? Ask a manager to provision one via Employee
            Management. Public sign-up is disabled.
          </div>
          <div className="mt-4 text-xs text-slate-500">
            <Link href="https://supabase.com/docs/guides/auth">
              Supabase Auth secured
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
