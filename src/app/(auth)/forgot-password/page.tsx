import Link from "next/link";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 flex items-center justify-center px-6">
      <div className="max-w-md w-full card bg-white/90 p-8 rounded-2xl">
        <div className="space-y-2 mb-6">
          <p className="text-sm text-slate-500">Reset password</p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Send reset instructions
          </h1>
        </div>
        <ResetPasswordForm />
        <div className="mt-4 text-sm">
          <Link href="/login" className="text-accent">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
