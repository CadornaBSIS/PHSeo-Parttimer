"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createEmployeeAction } from "@/features/employees/actions";
import { toast } from "sonner";

export function CreateEmployeeForm() {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    department: "Part Time",
    employee_code: "",
    status: "active",
    password: "",
  });

  const onSubmit = () => {
    startTransition(async () => {
      const usesAutoPassword = form.password.trim().length < 8;
      const result = await createEmployeeAction(form);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.success ??
          "Employee created. Share the password below securely.",
      );
      if (result.tempPassword) {
        toast.message("Temp password", {
          description: result.tempPassword,
          duration: 8000,
        });
        if (usesAutoPassword) {
          try {
            await navigator.clipboard.writeText(result.tempPassword);
            toast.success("Auto-generated password copied to clipboard.");
          } catch {
            toast.error("Could not copy password automatically.");
          }
        }
      }
      setForm({
        full_name: "",
        email: "",
        department: "Part Time",
        employee_code: "",
        status: "active",
        password: "",
      });
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Full name</Label>
          <Input
            value={form.full_name}
            onChange={(e) =>
              setForm((f) => ({ ...f, full_name: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1">
          <Label>Email</Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label>Department</Label>
          <Select
            value={form.department}
            onChange={(e) =>
              setForm((f) => ({ ...f, department: e.target.value }))
            }
          >
            <option value="Part Time">Part Time</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Employee code</Label>
          <Input
            value={form.employee_code}
            onChange={(e) =>
              setForm((f) => ({ ...f, employee_code: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1">
          <Label>Password (optional)</Label>
          <Input
            type="text"
            placeholder="Leave blank to auto-generate"
            value={form.password}
            onChange={(e) =>
              setForm((f) => ({ ...f, password: e.target.value }))
            }
          />
          <p className="text-xs text-slate-500">
            If left blank, a secure password will be generated and shown once.
          </p>
        </div>
        <div className="space-y-1">
          <Label>Status</Label>
          <Select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
      </div>
      <Button onClick={onSubmit} disabled={pending}>
        {pending ? "Creating..." : "Create employee"}
      </Button>
      <p className="text-xs text-slate-500">
        Accounts are created server-side using the Supabase service role key.
        Never expose the service key to clients.
      </p>
    </div>
  );
}
