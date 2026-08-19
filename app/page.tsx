import { redirect } from "next/navigation";
import BugList from "@/components/BugList";
import { currentSession } from "@/lib/auth";

export default async function Home() {
  const session = await currentSession();
  if (!session) redirect("/login");
  return <BugList currentUser={session.name} />;
}
