"use client";

import {
  ChangeEvent,
  useActionState,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  changeEmployeePasswordAction,
  changeOwnPasswordAction,
} from "@/features/auth/password-actions";

type EmployeeOption = {
  id: string;
  full_name: string;
  email: string;
  status: string;
};

function getPasswordIssues(password: string): string[] {
  const trimmed = password.trim();
  const issues: string[] = [];

  if (trimmed.length < 8) issues.push("At least 8 characters");
  if (!/[a-z]/.test(trimmed)) issues.push("One lowercase letter");
  if (!/[A-Z]/.test(trimmed)) issues.push("One uppercase letter");
  if (!/[0-9]/.test(trimmed)) issues.push("One number");
  if (!/[^A-Za-z0-9]/.test(trimmed)) issues.push("One symbol");

  return issues;
}

function PasswordField({
  id,
  name,
  label,
  placeholder,
  autoComplete,
  value,
  onChange,
  error,
}: {
  id: string;
  name: string;
  label: string;
  placeholder?: string;
  autoComplete?: string;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  error?: string | null;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          required
          minLength={8}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={`pr-11 ${error ? "border-red-500 focus-visible:ring-red-500" : ""}`}
          value={value}
          onChange={onChange}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-500 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function SubmitButton({
  disabled,
  idleText,
  pendingText,
}: {
  disabled?: boolean;
  idleText: string;
  pendingText: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full sm:w-auto" disabled={disabled || pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {pending ? pendingText : idleText}
    </Button>
  );
}

export function PasswordManagement({
  isManager,
  employees,
}: {
  isManager: boolean;
  employees: EmployeeOption[];
}) {
  const selfPasswordId = useId();
  const selfConfirmId = useId();
  const employeePasswordId = useId();
  const employeeConfirmId = useId();

  const [selfPassword, setSelfPassword] = useState("");
  const [selfConfirm, setSelfConfirm] = useState("");
  const [selfNotice, setSelfNotice] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState("");
  const [employeePassword, setEmployeePassword] = useState("");
  const [employeeConfirm, setEmployeeConfirm] = useState("");
  const [employeeNotice, setEmployeeNotice] = useState<string | null>(null);

  const [selfState, selfAction] = useActionState(changeOwnPasswordAction, {
    error: undefined,
    success: undefined,
  });

  const [empState, empAction] = useActionState(changeEmployeePasswordAction, {
    error: undefined,
    success: undefined,
  });

  const selfIssues = useMemo(() => getPasswordIssues(selfPassword), [selfPassword]);
  const selfConfirmError = useMemo(() => {
    if (!selfConfirm) return null;
    return selfPassword === selfConfirm ? null : "Passwords do not match.";
  }, [selfPassword, selfConfirm]);
  const canSubmitSelf = selfIssues.length === 0 && !selfConfirmError;

  const employeeIssues = useMemo(
    () => getPasswordIssues(employeePassword),
    [employeePassword],
  );
  const employeeConfirmError = useMemo(() => {
    if (!employeeConfirm) return null;
    return employeePassword === employeeConfirm ? null : "Passwords do not match.";
  }, [employeePassword, employeeConfirm]);
  const canSubmitEmployee =
    Boolean(employeeId) && employeeIssues.length === 0 && !employeeConfirmError;

  useEffect(() => {
    if (!selfState?.success) return;

    setSelfNotice(selfState.success);
    setSelfPassword("");
    setSelfConfirm("");
    toast.success(selfState.success);

    const timer = setTimeout(() => setSelfNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [selfState?.success]);

  useEffect(() => {
    if (!empState?.success) return;

    setEmployeeNotice(empState.success);
    setEmployeeId("");
    setEmployeePassword("");
    setEmployeeConfirm("");
    toast.success(empState.success);

    const timer = setTimeout(() => setEmployeeNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [empState?.success]);

  useEffect(() => {
    if (!selfState?.error) return;
    toast.error(selfState.error);
  }, [selfState?.error]);

  useEffect(() => {
    if (!empState?.error) return;
    toast.error(empState.error);
  }, [empState?.error]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-accent" />
            Change Your Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={selfAction} className="space-y-4">
            <PasswordField
              id={selfPasswordId}
              name="password"
              label="New password"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              value={selfPassword}
              onChange={(e) => setSelfPassword(e.target.value)}
              error={selfPassword ? (selfIssues[0] ?? null) : null}
            />
            <PasswordField
              id={selfConfirmId}
              name="confirm"
              label="Confirm password"
              placeholder="Re-type password"
              autoComplete="new-password"
              value={selfConfirm}
              onChange={(e) => setSelfConfirm(e.target.value)}
              error={selfConfirmError}
            />
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">Password rules</p>
              <p className="mt-1">
                {selfIssues.length
                  ? `Missing: ${selfIssues.join(", ")}.`
                  : "Looks good. Use a unique password you don’t reuse elsewhere."}
              </p>
            </div>

            {selfState?.error ? (
              <p className="text-sm text-red-600">{selfState.error}</p>
            ) : null}
            {selfNotice ? (
              <p className="text-sm text-emerald-700">{selfNotice}</p>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <SubmitButton
                disabled={!canSubmitSelf}
                idleText="Update password"
                pendingText="Updating..."
              />
              <Button variant="outline" asChild className="w-full sm:w-auto">
                <Link href="/forgot-password">Send reset link instead</Link>
              </Button>
            </div>
          </form>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-slate-600" />
              <p>
                If you suspect your account is compromised, update your password
                immediately. Use a unique password you don’t reuse elsewhere.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {isManager ? (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersRound className="h-5 w-5 text-accent" />
              Reset Employee Password
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={empAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="employee_id">Employee</Label>
                <Select
                  id="employee_id"
                  name="employee_id"
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                >
                  <option value="">Select employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.full_name} ({employee.email})
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-slate-500">
                  This sets a new password directly (no email). The employee may
                  need to log in again.
                </p>
              </div>

              <PasswordField
                id={employeePasswordId}
                name="password"
                label="New password"
                placeholder="Temporary password"
                autoComplete="new-password"
                value={employeePassword}
                onChange={(e) => setEmployeePassword(e.target.value)}
                error={employeePassword ? (employeeIssues[0] ?? null) : null}
              />
              <PasswordField
                id={employeeConfirmId}
                name="confirm"
                label="Confirm password"
                placeholder="Re-type password"
                autoComplete="new-password"
                value={employeeConfirm}
                onChange={(e) => setEmployeeConfirm(e.target.value)}
                error={employeeConfirmError}
              />

              {empState?.error ? (
                <p className="text-sm text-red-600">{empState.error}</p>
              ) : null}
              {employeeNotice ? (
                <p className="text-sm text-emerald-700">{employeeNotice}</p>
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <SubmitButton
                  disabled={!canSubmitEmployee}
                  idleText="Update employee password"
                  pendingText="Updating..."
                />
                <p className="text-xs text-slate-500">
                  Share the password via a secure channel.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
