import { redirect } from "next/navigation";
import BugForm from "@/components/BugForm";
import { currentSession } from "@/lib/auth";

export default async function NewBugPage() {
  const session = await currentSession();
  if (!session) redirect("/login");
  return <BugForm currentUser={session.name} />;
}
