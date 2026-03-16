"use client";

import Link from "next/link";
import { useActionState, useTransition } from "react";
import { Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction } from "@/features/auth/actions";
import { cn } from "@/lib/utils";

type State = { error?: string };

export function LoginForm() {
  const [state, formAction] = useActionState<State, FormData>(
    signInAction,
    {},
  );
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => startTransition(() => formAction(formData))}
      className="space-y-6"
    >
      <div className="space-y-2">
        <Label htmlFor="email">Work Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="pl-10"
            placeholder="you@company.com"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="pl-10"
            placeholder="••••••••"
          />
        </div>
      </div>
      {state?.error ? (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {state.error}
        </p>
      ) : null}
      <div className="flex items-center justify-between text-sm">
        <Link
          href="/forgot-password"
          className="text-accent hover:text-accent-dark font-medium"
        >
          Forgot password?
        </Link>
        <span className="text-slate-400">
          Manager-provisioned accounts only
        </span>
      </div>
      <Button
        type="submit"
        className={cn("w-full h-11")}
        disabled={pending}
      >
        {pending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
