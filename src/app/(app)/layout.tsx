import Link from "next/link";
import { requireUser, destroySession } from "@/lib/auth";
import { redirect } from "next/navigation";

const NAV = [
  ["/", "Ringkasan"],
  ["/compose", "Buat post"],
  ["/posts", "Post & jadual"],
  ["/ads", "Iklan"],
  ["/studio", "Studio AI"],
  ["/accounts", "Akaun"],
  ["/settings", "Tetapan"],
] as const;

async function logout() {
  "use server";
  await destroySession();
  redirect("/login");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="min-h-screen">
      <header className="border-b" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="font-semibold">Pibot Ads</span>
          <nav className="flex flex-wrap gap-4 text-sm">
            {NAV.map(([href, label]) => (
              <Link key={href} href={href} className="hover:underline">
                {label}
              </Link>
            ))}
          </nav>
          <form action={logout} className="ml-auto">
            <button className="text-sm muted hover:underline">Log keluar</button>
          </form>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
