import { redirect } from "next/navigation";
import ProjectsAdmin from "@/components/ProjectsAdmin";
import { currentSession } from "@/lib/auth";

export default async function SettingsPage() {
  const session = await currentSession();
  if (!session) redirect("/login");
  return <ProjectsAdmin />;
}
