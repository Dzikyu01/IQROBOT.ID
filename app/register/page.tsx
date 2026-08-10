"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Panggil signUp untuk pendaftaran akun baru
    const { data, error: registerError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (registerError) {
      setError(registerError.message);
      return;
    }
    
    alert("Registrasi berhasil! Silakan login.");
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
      <form onSubmit={handleRegister} className="w-full max-w-md space-y-4 rounded-xl bg-zinc-900 p-6 border border-zinc-800">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
        >
          ← Kembali ke Dashboard
        </button>
        <h1 className="text-2xl font-bold">Register</h1>
        <input
          type="email"
          placeholder="email@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded bg-zinc-800 p-3 text-white outline-none"
          required
        />
        <input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded bg-zinc-800 p-3 text-white outline-none"
          required
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" className="w-full rounded bg-indigo-600 p-3 font-semibold text-white hover:bg-indigo-500">
          Register
        </button>
      </form>
    </div>
  );
}