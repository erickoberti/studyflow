import { AppShell } from "@/components/app-shell";
import { ensureAuthenticated } from "@/app/actions";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await ensureAuthenticated();
  return <AppShell>{children}</AppShell>;
}
