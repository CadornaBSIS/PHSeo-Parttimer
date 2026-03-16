import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth/session";

export default async function ProfilePage() {
  const profile = await requireProfile();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="Your personal information."
      />
      <Card>
        <CardHeader>
          <CardTitle>{profile.full_name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          <p>Email: {profile.email}</p>
          <p>Role: {profile.role}</p>
          <p>Department: {profile.department ?? "—"}</p>
          <p>Employee code: {profile.employee_code ?? "—"}</p>
          <p>Status: {profile.status}</p>
        </CardContent>
      </Card>
    </div>
  );
}
