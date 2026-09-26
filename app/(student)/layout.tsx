import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <Link href="/dashboard" className="font-semibold tracking-tight">
          JEE E-Tutor
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-500">{user.displayName}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 bg-zinc-50 dark:bg-black">{children}</main>
    </div>
  );
}
