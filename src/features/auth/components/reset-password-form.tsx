"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendResetPassword } from "@/features/auth/actions";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(sendResetPassword, {
    error: undefined,
    success: undefined,
  });

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Work Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            id="email"
            name="email"
            type="email"
            required
            className="pl-10"
            placeholder="you@company.com"
          />
        </div>
      </div>
      {state?.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}
      {state?.success ? (
        <p className="text-sm text-emerald-600">{state.success}</p>
      ) : null}
      <Button type="submit" className="w-full">
        Send reset link
      </Button>
    </form>
  );
}
