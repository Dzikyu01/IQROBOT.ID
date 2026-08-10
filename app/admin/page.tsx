"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

interface UserProfile {
  id: string;
  email: string;
  role: string;
  is_premium: boolean;
  created_at: string;
}

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

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // State Form Modal CRUD Video
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrlInput, setVideoUrlInput] = useState("");
  
  // State untuk Thumbnail File & Existing URL
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [existingThumbnailUrl, setExistingThumbnailUrl] = useState("");

  const [isPremium, setIsPremium] = useState(false);
  const [type, setType] = useState<"film" | "trailer">("film");
  const [playlistTitle, setPlaylistTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function checkAdminAndFetchData() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role !== "admin") {
        alert("Akses ditolak! Anda bukan admin.");
        router.push("/dashboard");
        return;
      }

      await Promise.all([fetchUsers(), fetchVideos()]);
      setLoading(false);
    }

    checkAdminAndFetchData();
  }, [router]);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, role, is_premium, created_at")
      .order("created_at", { ascending: false });

    if (data) setUsers(data);
  };

  const fetchVideos = async () => {
    const { data } = await supabase
      .from("videos")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setVideos(data);
  };

  // 🛠️ MENGUBAH LINK GOOGLE DRIVE MENJADI EMBED PREVIEW (BEBAS ERROR 403)
  const convertDriveUrlToEmbed = (url: string) => {
    if (!url) return "";
    
    const matchD = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const matchId = url.match(/id=([a-zA-Z0-9_-]+)/);

    const fileId = matchD ? matchD[1] : matchId ? matchId[1] : null;

    if (fileId) {
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }

    return url;
  };

  // Toggle Status Premium User
  const handleTogglePremium = async (targetUserId: string, currentStatus: boolean) => {
    setUpdatingId(targetUserId);
    const newStatus = !currentStatus;

    const { error } = await supabase
      .from("profiles")
      .update({ is_premium: newStatus })
      .eq("id", targetUserId);

    if (error) {
      alert(`Gagal mengubah status: ${error.message}`);
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUserId ? { ...u, is_premium: newStatus } : u))
      );
    }
    setUpdatingId(null);
  };

  // Buka Modal Tambah/Edit Video
  const handleOpenModal = (video?: Video) => {
    if (video) {
      setEditingVideo(video);
      setTitle(video.title);
      setDescription(video.description || "");
      setVideoUrlInput(video.video_url);
      setExistingThumbnailUrl(video.thumbnail_url || "");
      setThumbnailFile(null);
      setIsPremium(video.is_premium);
      setType(video.type);
      setPlaylistTitle(video.playlist_title || "");
    } else {
      setEditingVideo(null);
      setTitle("");
      setDescription("");
      setVideoUrlInput("");
      setExistingThumbnailUrl("");
      setThumbnailFile(null);
      setIsPremium(false);
      setType("film");
      setPlaylistTitle("");
    }
    setIsModalOpen(true);
  };

  // Submit Handler (Create & Update Video dengan Upload Thumbnail ke Supabase Storage)
  const handleSubmitVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    let finalThumbnailUrl = existingThumbnailUrl;

    // Jika admin memilih file gambar baru dari laptop, upload ke bucket "thumbnails"
    if (thumbnailFile) {
      const fileExt = thumbnailFile.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("thumbnails")
        .upload(fileName, thumbnailFile);

      if (uploadError) {
        alert("Gagal mengupload thumbnail: " + uploadError.message);
        setSubmitting(false);
        return;
      }

      // Ambil Public URL dari file yang di-upload
      const { data: publicURLData } = supabase.storage
        .from("thumbnails")
        .getPublicUrl(fileName);

      finalThumbnailUrl = publicURLData.publicUrl;
    }

    // Otomatis ubah link ke format /preview sebelum disimpan
    const finalEmbedUrl = convertDriveUrlToEmbed(videoUrlInput);

    const payload = {
      title,
      description,
      video_url: finalEmbedUrl,
      thumbnail_url: finalThumbnailUrl || null,
      is_premium: isPremium,
      type,
      playlist_title: playlistTitle || null,
    };

    if (editingVideo) {
      const { error } = await supabase
        .from("videos")
        .update(payload)
        .eq("id", editingVideo.id);

      if (error) {
        alert("Gagal memperbarui video: " + error.message);
      } else {
        alert("Video berhasil diperbarui!");
        fetchVideos();
        setIsModalOpen(false);
      }
    } else {
      const { error } = await supabase.from("videos").insert([payload]);

      if (error) {
        alert("Gagal menambahkan video: " + error.message);
      } else {
        alert("Video berhasil ditambahkan!");
        fetchVideos();
        setIsModalOpen(false);
      }
    }

    setSubmitting(false);
  };

  // Delete Video
  const handleDeleteVideo = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus video ini?")) return;

    const { error } = await supabase.from("videos").delete().eq("id", id);

    if (error) {
      alert("Gagal menghapus video: " + error.message);
    } else {
      setVideos((prev) => prev.filter((v) => v.id !== id));
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="text-sm text-zinc-400">Memuat data admin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8 lg:px-8 lg:py-10">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div>
            <h1 className="text-2xl font-bold text-white md:text-3xl">
              Panel Admin <span className="text-indigo-400">🛠️</span>
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Kelola pengguna dan perpustakaan video
            </p>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-700 hover:text-white border border-zinc-700/50"
          >
            <span>←</span> Kembali ke Dashboard
          </button>
        </div>

        {/* SECTION 1: MANAJEMEN VIDEO (CRUD) */}
        <section className="mb-10">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Kelola Katalog Video</h2>
              <p className="text-sm text-zinc-400">Tambah, ubah, dan hapus konten teaser atau video</p>
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-500 shadow-lg shadow-indigo-600/20"
            >
              <span>+</span> Tambah Video Baru
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-800/60 text-xs uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="px-4 py-3 md:px-6 md:py-4">Thumbnail</th>
                    <th className="px-4 py-3 md:px-6 md:py-4">Judul</th>
                    <th className="hidden px-4 py-3 md:table-cell md:px-6 md:py-4">Tipe</th>
                    <th className="px-4 py-3 md:px-6 md:py-4">Akses</th>
                    <th className="hidden px-4 py-3 lg:table-cell md:px-6 md:py-4">URL Video</th>
                    <th className="px-4 py-3 text-center md:px-6 md:py-4">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {videos.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-zinc-500 md:px-6">
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-3xl">🎬</span>
                          <p>Belum ada video yang diunggah.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    videos.map((v) => (
                      <tr key={v.id} className="transition hover:bg-zinc-800/30">
                        <td className="px-4 py-3 md:px-6 md:py-4">
                          <div className="h-12 w-20 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 flex items-center justify-center">
                            {v.thumbnail_url ? (
                              <img 
                                src={v.thumbnail_url} 
                                alt={v.title} 
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <span className="text-[10px] text-zinc-600">No Image</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-white md:px-6 md:py-4">
                          <div className="max-w-[150px] truncate md:max-w-[200px]">
                            {v.title}
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell md:px-6 md:py-4">
                          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                            v.type === "film" 
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                          }`}>
                            {v.type === "film" ? "Teaser" : "Video"}
                          </span>
                        </td>
                        <td className="px-4 py-3 md:px-6 md:py-4">
                          {v.is_premium ? (
                            <span className="inline-block rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400 border border-amber-500/20">
                              🔒 Premium
                            </span>
                          ) : (
                            <span className="inline-block rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-400 border border-zinc-700/50">
                              Gratis
                            </span>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 lg:table-cell md:px-6 md:py-4">
                          <div className="max-w-[150px] truncate text-xs text-zinc-500">
                            {v.video_url}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center md:px-6 md:py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleOpenModal(v)}
                              className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-700 hover:text-white"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteVideo(v.id)}
                              className="rounded-lg bg-red-600/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-600 hover:text-white border border-red-500/20"
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* SECTION 2: MANAJEMEN USER */}
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-bold text-white">Daftar Pengguna</h2>
            <p className="text-sm text-zinc-400">Atur akses status premium member</p>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-800/60 text-xs uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="px-4 py-3 md:px-6 md:py-4">Email User</th>
                    <th className="hidden px-4 py-3 sm:table-cell md:px-6 md:py-4">Role</th>
                    <th className="px-4 py-3 md:px-6 md:py-4">Status Premium</th>
                    <th className="px-4 py-3 text-center md:px-6 md:py-4">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-zinc-500 md:px-6">
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-3xl">👤</span>
                          <p>Belum ada pengguna terdaftar.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="transition hover:bg-zinc-800/30">
                        <td className="px-4 py-3 font-medium text-white md:px-6 md:py-4">
                          <div className="max-w-[150px] truncate md:max-w-[200px]">
                            {u.email}
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell md:px-6 md:py-4">
                          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold border ${
                            u.role === "admin"
                              ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                              : "bg-zinc-800 text-zinc-400 border-zinc-700/50"
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 md:px-6 md:py-4">
                          {u.is_premium ? (
                            <span className="inline-block rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400 border border-amber-500/20">
                              👑 Premium
                            </span>
                          ) : (
                            <span className="inline-block rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-400 border border-zinc-700/50">
                              Gratis
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center md:px-6 md:py-4">
                          <button
                            disabled={updatingId === u.id}
                            onClick={() => handleTogglePremium(u.id, u.is_premium)}
                            className={`inline-flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 md:px-4 md:py-2 ${
                              u.is_premium
                                ? "bg-red-600/10 text-red-400 border border-red-500/20 hover:bg-red-600 hover:text-white"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500 hover:text-black"
                            }`}
                          >
                            {updatingId === u.id ? (
                              <>
                                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                                Memproses...
                              </>
                            ) : u.is_premium ? (
                              "Cabut Premium"
                            ) : (
                              "Jadikan Premium 👑"
                            )}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {/* MODAL FORM (CREATE / UPDATE VIDEO) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between border-b border-zinc-800 pb-4">
              <h3 className="text-xl font-bold text-white">
                {editingVideo ? "Edit Video ✏️" : "Tambah Video Baru 🎬"}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmitVideo} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Judul Video <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Teaser Terbaru 2026"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 text-sm text-white transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Deskripsi Ringkas
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tuliskan deskripsi singkat..."
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 text-sm text-white transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Link Google Drive <span className="text-amber-400 font-normal">(Tempel link biasa)</span> <span className="text-red-400">*</span>
                </label>
                <input
                  type="url"
                  required
                  value={videoUrlInput}
                  onChange={(e) => setVideoUrlInput(e.target.value)}
                  placeholder="https://drive.google.com/file/d/..."
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 text-sm text-white transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Upload Gambar Thumbnail / Poster <span className="text-zinc-500 font-normal">(Opsional)</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setThumbnailFile(e.target.files[0]);
                    }
                  }}
                  className="w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-sm text-zinc-300 file:mr-4 file:rounded file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-indigo-500 transition"
                />

                {existingThumbnailUrl && !thumbnailFile && (
                  <div className="mt-3 flex items-center gap-3 rounded-lg bg-zinc-800/50 p-2.5">
                    <span className="text-xs text-zinc-400">Thumbnail saat ini:</span>
                    <img
                      src={existingThumbnailUrl}
                      alt="Thumbnail Preview"
                      className="h-12 w-20 rounded-lg border border-zinc-700 object-cover"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                    Tipe Konten
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as "film" | "trailer")}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 text-sm text-white transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="film">🍿 Teaser</option>
                    <option value="trailer">🎬 Video</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                    Nama Playlist <span className="text-zinc-500 font-normal">(Opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={playlistTitle}
                    onChange={(e) => setPlaylistTitle(e.target.value)}
                    placeholder="Contoh: Action Movies"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 text-sm text-white transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-amber-500/5 border border-amber-500/10 p-3">
                <input
                  type="checkbox"
                  id="isPremiumCheck"
                  checked={isPremium}
                  onChange={(e) => setIsPremium(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:ring-offset-0"
                />
                <label htmlFor="isPremiumCheck" className="text-sm font-semibold text-amber-400">
                  Khusus Member Premium 👑
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-zinc-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg bg-zinc-800 px-5 py-2.5 text-sm font-semibold text-zinc-400 transition hover:bg-zinc-700 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-50 shadow-lg shadow-indigo-600/20"
                >
                  {submitting ? "Menyimpan..." : "Simpan Video"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}