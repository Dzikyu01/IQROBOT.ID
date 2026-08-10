"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link"; // Tambahkan link untuk navigasi ke register
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // 1. Verifikasi Email & Password ke Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    // 2. Jika login gagal -> Stop
    if (authError || !authData.user) {
      setError("Email atau password salah / belum terdaftar!");
      setLoading(false);
      return;
    }

    // 3. Update status online
    await supabase
      .from("profiles")
      .update({
        is_online: true,
        last_seen: new Date().toISOString(),
      })
      .eq("id", authData.user.id);

    // 4. Ambil data role terbaru dari tabel profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();

    setLoading(false);

    if (profileError) {
      console.error("Gagal mengambil profile:", profileError.message);
    }

    // 5. Redirection berdasarkan role
    if (profile?.role === "admin") {
      router.push("/admin");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-white">
      <div className="w-full max-w-md space-y-6">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
        >
          ← Kembali ke Dashboard
        </button>
        
        {/* Sambutan Selamat Datang */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Selamat Datang! 👋</h1>
          <p className="text-sm text-zinc-400">
            Silakan masuk ke akun Anda atau daftar jika belum memiliki akun.
          </p>
        </div>

        {/* Pilihan Tab / Tombol Navigasi Login & Register */}
        <div className="flex rounded-xl bg-zinc-900 p-1 border border-zinc-800">
          <button
            type="button"
            className="flex-1 rounded-lg bg-zinc-800 py-2.5 text-sm font-semibold text-white shadow"
          >
            Masuk (Login)
          </button>
          <Link
            href="/register"
            className="flex-1 rounded-lg py-2.5 text-center text-sm font-medium text-zinc-400 transition hover:text-white"
          >
            Daftar (Register)
          </Link>
        </div>

        {/* Form Login */}
        <form
          onSubmit={handleLogin}
          className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl"
        >
          <div>
            <label className="text-sm text-zinc-400">Email</label>
            <input
              type="email"
              placeholder="nama@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded bg-zinc-800 p-3 text-white outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="text-sm text-zinc-400">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded bg-zinc-800 p-3 text-white outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          {error && (
            <div className="rounded border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-indigo-600 p-3 font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>

      </div>
    </div>
  );
}