import { createSupabaseServer } from "../../lib/supabase-server";
import { redirect } from "next/navigation";
import Dashboard from "../../components/Dashboard";

export default async function DashboardPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return <main className="container"><div className="card">
      <h1>Profile not found</h1>
      <p>Run the Supabase SQL schema and ensure your user has a profile.</p>
    </div></main>;
  }

  return <Dashboard user={user} profile={profile} />;
}