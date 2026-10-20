import { redirect } from "next/navigation";
import { checkCredentials, createSession } from "@/lib/auth";

async function login(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!checkCredentials(email, password)) redirect("/login?error=1");
  await createSession(email);
  redirect("/");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <form action={login} className="card w-full max-w-sm space-y-3">
        <h1 className="text-xl font-semibold">Pibot Ads</h1>
        {error && <p className="text-sm text-red-500">Email atau kata laluan salah.</p>}
        <div>
          <label>Email</label>
          <input name="email" type="email" required autoComplete="username" />
        </div>
        <div>
          <label>Kata laluan</label>
          <input name="password" type="password" required autoComplete="current-password" />
        </div>
        <button className="btn w-full justify-center">Log masuk</button>
      </form>
    </main>
  );
}
