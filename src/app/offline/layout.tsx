import { OfflineShell } from "@/components/offline-shell";

export default function OfflineLayout({ children }: { children: React.ReactNode }) {
  return <OfflineShell>{children}</OfflineShell>;
}
