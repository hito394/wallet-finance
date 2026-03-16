import "../styles/globals.css";
import type { ReactNode } from "react";

import AppShell from "@/components/app-shell";

export const metadata = {
  title: "AI Finance Assistant",
  description: "Automation-first personal finance command center",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
