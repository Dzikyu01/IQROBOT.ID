"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Video {
  id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url?: string | null;
  is_premium: boolean;
  type: "film" | "trailer";
  playlist_title: string | null;
  created_at: string;
}

const INITIAL_FORM = {
  id: null as string | null,
  title: "",
  description: "",
  video_url: "",
  thumbnail_url: "",
  is_premium: true,
  type: "film" as "film" | "trailer",
  playlist_title: "",
};

export default function AdminVideosPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);

  const fetchVideos = useCallback(async () => {
    const { data } = await supabase
      .from("videos")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setVideos(data);
  }, [supabase]);

  useEffect(() => {
    async function initAdmin() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.push("/login");

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role !== "admin") return router.push("/dashboard");

      await fetchVideos();
      setLoading(false);
    }

    initAdmin();
  }, [router, supabase, fetchVideos]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        openModal();
      }
      if (e.key === "Escape" && isModalOpen) {
        closeModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  const openModal = (video?: Video) => {
    if (video) {
      setFormData({
        id: video.id,
        title: video.title,
        description: video.description || "",
        video_url: video.video_url,
        thumbnail_url: video.thumbnail_url || "",
        is_premium: video.is_premium ?? true,
        type: video.type,
        playlist_title: video.playlist_title || "",
      });
    } else {
      setFormData(INITIAL_FORM);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData(INITIAL_FORM);
  };

  // 📤 FUNGSI UPLOAD GAMBAR KE SUPABASE STORAGE
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);

      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
      const filePath = `thumbnails/${fileName}`;

      // Upload ke bucket Supabase bernama 'thumbnails'
      const { error: uploadError } = await supabase.storage
        .from("thumbnails")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Ambil URL publik dari berkas yang diunggah
      const { data: publicUrlData } = supabase.storage
        .from("thumbnails")
        .getPublicUrl(filePath);

      setFormData((prev) => ({
        ...prev,
        thumbnail_url: publicUrlData.publicUrl,
      }));
    } catch (err: any) {
      alert(`Gagal mengunggah gambar: ${err.message || "Terjadi kesalahan"}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      title: formData.title,
      description: formData.description,
      video_url: formData.video_url,
      thumbnail_url: formData.thumbnail_url || null,
      is_premium: formData.is_premium,
      type: formData.type,
      playlist_title: formData.playlist_title || null,
    };

    if (formData.id) {
      await supabase.from("videos").update(payload).eq("id", formData.id);
    } else {
      await supabase.from("videos").insert([payload]);
    }

    setSubmitting(false);
    closeModal();
    fetchVideos();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Apakah kamu yakin ingin menghapus video ini?")) {
      await supabase.from("videos").delete().eq("id", id);
      fetchVideos();
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <p className="animate-pulse text-zinc-400">Memuat data video...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6 md:p-8 text-white">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold">Kelola Treasure & Video</h1>
            <p className="text-sm text-zinc-400">Kelola playlist treasure dan video promosi</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/admin")}
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium hover:bg-zinc-700 transition"
            >
              ← Kembali
            </button>
            <button
              onClick={() => openModal()}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/20"
            >
              <span>+ Tambah Content</span>
              <kbd className="hidden md:inline-block text-[10px] bg-indigo-800/80 px-1.5 py-0.5 rounded text-indigo-200">
                Ctrl K
              </kbd>
            </button>
          </div>
        </div>

        {/* Tabel Data Video */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden shadow-xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-800/60 text-zinc-400 border-b border-zinc-800 uppercase text-[11px] tracking-wider font-semibold">
              <tr>
                <th className="p-4">Poster</th>
                <th className="p-4">Detail Video</th>
                <th className="p-4">Kategori / Tipe</th>
                <th className="p-4">Aksesibilitas</th>
                <th className="p-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {videos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-500">
                    Belum ada konten terdaftar.
                  </td>
                </tr>
              ) : (
                videos.map((v) => (
                  <tr key={v.id} className="hover:bg-zinc-800/40 transition">
                    <td className="p-4 w-20">
                      <div className="w-14 h-20 rounded-md bg-zinc-950 border border-zinc-800 overflow-hidden flex items-center justify-center">
                        {v.thumbnail_url ? (
                          <img src={v.thumbnail_url} alt={v.title} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] text-zinc-600 font-medium">No Image</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 font-medium">
                      <div className="text-white font-semibold">{v.title}</div>
                      <div className="text-xs text-zinc-400 max-w-xs truncate">{v.description || "-"}</div>
                    </td>
                    <td className="p-4">
                      {v.type === "trailer" ? (
                        <span className="rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2.5 py-1 text-xs font-semibold">
                          🎬 Video
                        </span>
                      ) : (
                        <div className="space-y-0.5">
                          <span className="rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 text-xs font-semibold inline-block">
                            🍿 Playlist Treasure
                          </span>
                          {v.playlist_title && (
                            <p className="text-[11px] text-zinc-400 font-medium">
                              Album: <span className="text-zinc-200">{v.playlist_title}</span>
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      {v.is_premium ? (
                        <span className="rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 text-xs font-semibold">
                          👑 Khusus Premium
                        </span>
                      ) : (
                        <span className="rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 text-xs font-semibold">
                          Semua User
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => openModal(v)}
                        className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(v.id)}
                        className="rounded-md bg-red-600/10 text-red-400 border border-red-500/20 px-3 py-1.5 text-xs hover:bg-red-600 hover:text-white transition"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Modal Popup Form (Edit / Tambah) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            
            {/* Header Modal */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                {formData.id ? "Edit Video ✏️" : "Tambah Video Baru 🎬"}
              </h2>
              <button onClick={closeModal} className="text-zinc-500 hover:text-white text-lg">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Judul Video */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Judul Video</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Contoh: Treasure Terbaru 2026"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Deskripsi */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Deskripsi Ringkas</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Tuliskan deskripsi singkat..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Link Video / Drive */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Link Google Drive <span className="text-amber-400 font-normal">(Tempel link biasa)</span>
                </label>
                <input
                  type="url"
                  required
                  value={formData.video_url}
                  onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                  placeholder="https://drive.google.com/file/d/..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              {/* SECTION UPLOAD THUMBNAIL / POSTER */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-zinc-400">
                  Link Poster / Thumbnail Image <span className="text-zinc-500">(Opsional)</span>
                </label>

                <div className="flex items-center gap-3">
                  {/* Box Preview Gambar */}
                  <div className="relative w-16 h-20 rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden flex items-center justify-center shrink-0">
                    {formData.thumbnail_url ? (
                      <img src={formData.thumbnail_url} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-zinc-500 text-center px-1">Belum Ada</span>
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    {/* Input Pilih File dari Komputer/HP */}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      disabled={uploadingImage}
                      className="block w-full text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600/20 file:text-indigo-400 hover:file:bg-indigo-600/30 cursor-pointer disabled:opacity-50"
                    />
                    
                    {uploadingImage && (
                      <p className="text-[11px] text-indigo-400 animate-pulse">Mengunggah gambar ke server...</p>
                    )}

                    {/* Input manual URL alternatif */}
                    <input
                      type="url"
                      value={formData.thumbnail_url}
                      onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                      placeholder="Atau tempel URL gambar..."
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Tipe & Playlist */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Tipe Konten</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as "film" | "trailer" })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="film">🍿 Treasure</option>
                    <option value="trailer">🎬 Video</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Nama Playlist (Opsional)</label>
                  <input
                    type="text"
                    value={formData.playlist_title}
                    onChange={(e) => setFormData({ ...formData, playlist_title: e.target.value })}
                    placeholder="Contoh: Action Movies"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Status Premium */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isPremiumCheck"
                  checked={formData.is_premium}
                  onChange={(e) => setFormData({ ...formData, is_premium: e.target.checked })}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-indigo-600 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="isPremiumCheck" className="text-xs font-semibold text-amber-400 cursor-pointer select-none">
                  Khusus Member Premium 👑
                </label>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-400 text-sm font-semibold hover:bg-zinc-700 hover:text-white transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploadingImage}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {submitting ? "Memproses..." : "Simpan Video"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}