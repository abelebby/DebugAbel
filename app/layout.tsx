import type { Metadata } from "next";
import "./globals.css";
import Topbar from "@/components/Topbar";
import { currentSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Bug Tracker",
  description: "Internal bug tracker",
};

// Runs before paint so the saved theme is applied without a flash.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('bt-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await currentSession();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {session ? <Topbar name={session.name} /> : null}
        {children}
      </body>
    </html>
  );
}
