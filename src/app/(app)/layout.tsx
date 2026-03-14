import { AppShell } from "@/components/app-shell";
import { ensureAuthenticated } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { getStudyGuideState } from "@/lib/study-guide";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await ensureAuthenticated();
  const user = await requireUser();
  const state = await getStudyGuideState(user.id);
  return (
    <AppShell
      currentUser={{
        name: user.name,
        email: user.email,
      }}
      currentGuide={
        state.activeGuide
          ? {
              id: state.activeGuide.id,
              name: state.activeGuide.name,
              icon: state.activeGuide.icon,
              color: state.activeGuide.color,
            }
          : undefined
      }
      guideOptions={state.guides.map((guide) => ({
        id: guide.id,
        name: guide.name,
        icon: guide.icon,
        color: guide.color,
      }))}
    >
      {children}
    </AppShell>
  );
}
