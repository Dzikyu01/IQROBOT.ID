"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import iqrobotLogo from "./image/iqrobot.png";
import logoImage from "./image/logo.png";
import thumbnailImage from "./image/tmbnail.jpeg";

const supabase = createClient();
const NOMOR_WHATSAPP_ADMIN = "6285700415441"; 

interface UserProfile {
  email: string;
  role: string;
  is_premium: boolean;
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

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"film" | "trailer">("film");
  const [showAssistant, setShowAssistant] = useState(false);

  // State untuk Fitur Like Origin Story
  const [originStoryLikes, setOriginStoryLikes] = useState<number>(0);
  const [hasLikedOrigin, setHasLikedOrigin] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    async function initData() {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        if (isMounted) {
          setUserId(user.id);
        }

        const { data: profileData } = await supabase
          .from("profiles")
          .select("email, role, is_premium")
          .eq("id", user.id)
          .maybeSingle();

        if (isMounted && profileData) {
          setProfile(profileData);
        }
      }

      const { data: videoData } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });

      if (isMounted && videoData) {
        setVideos(videoData);
      }

      if (isMounted) {
        setLoading(false);
      }
    }

    initData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch data likes untuk Origin Story setelah videos & userId siap
  useEffect(() => {
    async function fetchOriginLikes() {
      const originVideo = videos.find(v => v.title.toLowerCase().includes("iqrobot"));
      if (!originVideo) return;

      // 1. Ambil total likes
      const { count } = await supabase
        .from("video_likes")
        .select("*", { count: "exact", head: true })
        .eq("video_id", originVideo.id);

      setOriginStoryLikes(count || 0);

      // 2. Cek apakah user yang sedang login sudah like
      if (userId) {
        const { data: userLike } = await supabase
          .from("video_likes")
          .select("id")
          .eq("video_id", originVideo.id)
          .eq("user_id", userId)
          .maybeSingle();

        if (userLike) {
          setHasLikedOrigin(true);
        }
      }
    }

    if (videos.length > 0) {
      fetchOriginLikes();
    }
  }, [videos, userId]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`profile-changes-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) {
            setProfile((prev) => (prev ? { ...prev, ...payload.new } : null));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const handleLogout = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ is_online: false }).eq("id", user.id);
    }
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleWatchClick = (video: Video) => {
    if (!userId) {
      router.push("/login");
      return;
    }

    if (video.is_premium && !profile?.is_premium && profile?.role !== "admin") {
      setShowPremiumModal(true);
      return;
    }

    setSelectedVideo(video);
  };

  const handleLikeOriginStory = async () => {
    if (!userId) {
      router.push("/login");
      return;
    }

    const originVideo = videos.find(v => v.title.toLowerCase().includes("iqrobot"));
    if (!originVideo) return;

    if (hasLikedOrigin) {
      // Unlike
      const { error } = await supabase
        .from("video_likes")
        .delete()
        .eq("video_id", originVideo.id)
        .eq("user_id", userId);

      if (!error) {
        setHasLikedOrigin(false);
        setOriginStoryLikes((prev) => Math.max(0, prev - 1));
      }
    } else {
      // Like
      const { error } = await supabase
        .from("video_likes")
        .insert({ video_id: originVideo.id, user_id: userId });

      if (!error) {
        setHasLikedOrigin(true);
        setOriginStoryLikes((prev) => prev + 1);
      }
    }
  };

  const handleUpgradeViaWhatsApp = () => {
    const nomorFormatted = NOMOR_WHATSAPP_ADMIN.replace(/^0/, "62"); 
    const emailUser = profile?.email ? profile.email.split("@")[0] : "User";
    
    const pesan = `Halo Admin, saya mau upgrade akun ke Premium agar bisa menonton koleksi teaser.

Detail Akun:
- Email: ${emailUser}

Mohon instruksi pembayaran selengkapnya. Terima kasih!`;

    const waUrl = `https://wa.me/${nomorFormatted}?text=${encodeURIComponent(pesan)}`;
    window.open(waUrl, "_blank");
  };

  const getEmbedUrl = (rawUrl: string) => {
    if (!rawUrl) return "";
    
    const matchD = rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const matchId = rawUrl.match(/id=([a-zA-Z0-9_-]+)/);
    const fileId = matchD ? matchD[1] : matchId ? matchId[1] : null;

    if (fileId) {
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }

    return rawUrl;
  };

  const filteredVideos = videos.filter((v) => v.type === activeTab);
  const galleryImages = [
    "/roadshow/01.JPG",
    "/roadshow/02.JPG",
    "/roadshow/03.JPG",
    "/roadshow/04.JPG",
    "/roadshow/05.JPG",
    "/roadshow/06.JPG",
    "/roadshow/07.JPG",
    "/roadshow/08.JPG",
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-400 font-medium animate-pulse">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <style jsx global>{`
        @keyframes gallery-scroll {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
      `}</style>
      
      {/* Animated Background Elements - Grayscale */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-48 h-48 sm:w-80 sm:h-80 bg-white/5 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-float"></div>
        <div className="absolute -bottom-40 -left-40 w-48 h-48 sm:w-80 sm:h-80 bg-white/5 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-float-delayed"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full mix-blend-multiply filter blur-3xl opacity-5 animate-spin-slow"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 relative z-10">
        <button
          onClick={() => setShowAssistant((prev) => !prev)}
          className="fixed bottom-6 right-6 z-50 flex h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-black shadow-2xl shadow-black/40 transition-all duration-300 hover:scale-110"
          aria-label="Buka asisten"
        >
          <video
            src="/assistent.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="h-full w-full object-cover"
          />
        </button>

        {showAssistant && (
          <div className="fixed bottom-24 right-6 z-50 w-64 sm:w-80 rounded-2xl border border-white/10 bg-black/90 p-4 shadow-2xl shadow-black/60 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Asisten IQROBOT</p>
                <p className="text-xs text-gray-400">Siap membantu Anda</p>
              </div>
              <button
                onClick={() => setShowAssistant(false)}
                className="rounded-full border border-white/10 px-2 py-1 text-sm text-gray-300 hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="mb-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-gray-300">
              Halo! Saya bisa membantu Anda melihat playlist, mengakses video, atau menghubungi admin.
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => setActiveTab("film")}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white transition hover:bg-white/10"
              >
                🎬 Lihat Playlist Teaser
              </button>
              <button
                onClick={() => setActiveTab("trailer")}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white transition hover:bg-white/10"
              >
                ▶️ Lihat Video
              </button>
              <button
                onClick={() => window.open("https://wa.me/6285700415441", "_blank")}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white transition hover:bg-white/10"
              >
                💬 Hubungi Admin
              </button>
            </div>
          </div>
        )}
        
        <nav className="mb-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-white/5">
          <div className="flex flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between md:px-8">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3 group">
                <div className="relative">
                  <img
                    src={iqrobotLogo.src}
                    alt="IQROBOT.ID"
                    className="hidden md:block h-10 w-10 rounded-full object-cover ring-2 ring-white/20 transition-all duration-500 group-hover:ring-white/40 group-hover:scale-110 group-hover:rotate-12"
                  />
                  <div className="absolute inset-0 rounded-full ring-2 ring-white/20 animate-ping-slow"></div>
                </div>
                <h1 className="text-2xl font-bold text-white transition-all duration-300 group-hover:text-gray-300">
                  IQROBOT.ID
                </h1>
              </div>
              {userId ? (
                profile?.is_premium ? (
                  <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white animate-pulse-slow">
                    👑 Premium
                  </span>
                ) : (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-gray-400">
                    Akun Gratis
                  </span>
                )
              ) : (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-gray-400">
                  Tamu
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {userId ? (
                <>
                  {profile?.role === "admin" && (
                    <button
                      onClick={() => router.push("/admin")}
                      className="rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white/10 hover:border-white/40 hover:scale-105 hover:shadow-lg hover:shadow-white/10"
                    >
                      🛠️ Panel Admin
                    </button>
                  )}
                  <button
                    onClick={handleLogout}
                    className="rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white/10 hover:border-white/40 hover:scale-105 hover:shadow-lg hover:shadow-white/10"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    href="/login"
                    className="rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white/10 hover:scale-105"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition-all hover:bg-gray-200 hover:scale-105 shadow-lg shadow-white/10"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        </nav>

        <section className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-white/5 backdrop-blur-sm transition-all duration-500 hover:shadow-white/10">
          <div className="h-50 mb-6 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-white/5 via-transparent to-white/5 px-6 relative">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between relative z-10">
              <div className="max-w-2xl">
                <p className="text-3xl font-semibold uppercase tracking-[0.2em] text-white/60 animate-slide-in">
                  Ayo Selesaikan Misimu!!!
                </p>
                <h2 className="mt-2 text-2xl font-bold text-white animate-slide-in-delayed">
                  {userId ? (profile?.email ? profile.email.split("@")[0] : profile?.email || "Pengguna") : "Menjadi Teman IQROBOT"}
                </h2>
                <p className="mb-26 mt-2 text-sm text-gray-400 animate-slide-in-delayed-2">
                  {userId
                    ? (
                      <>
                        Belajar bersama lebih dekat dengan nilai - nilai Al-Qu'an melalui kisah dan kreativitas. 
                        <br/> Menjadi teman screen time yang seru sekaligus membentuk akhlak dan kebiasaan yang baik.
                        <br />
                        Storytelling - Vidio Edukasi - Roadshow
                      </>
                    )
                    : "AYOO GUYSS LOGIN DULUUU!!"}
                </p>
              </div>

              <div className="shrink-0">
                <img
                  src={iqrobotLogo.src}
                  className="hidden md:block rounded-2xl object-cover object-bottom lg:h-80 lg:w-100 transition-all duration-1000 hover:scale-110 hover:rotate-3"
                  style={{
                    animation: "characterIdle 5s ease-in-out infinite",
                    transformOrigin: "center bottom",
                  }}
                />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-white/20 via-white/40 to-white/20 bg-[length:200%_100%] animate-gradient-x"></div>
          </div>
        </section>

        {/* Section Origin Story dengan Tombol Like & Counter */}
        <section className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-white/5 transition-all duration-300 hover:shadow-white/10">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] xl:grid-cols-[1.5fr_1fr] items-center">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/80">
              <img
                src={thumbnailImage.src}
                alt="Thumbnail Origin Story"
                className="h-72 w-full min-h-[18rem] object-cover"
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-black text-3xl shadow-xl">
                  ▶
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-sm shadow-white/5">
                <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Origin Story</p>
                <h3 className="mt-3 text-2xl font-bold text-white">IQROBOT</h3>
                <p className="mt-3 text-sm leading-6 text-gray-300">
                 Kisah original IQROBOT, superhero yang terinspirasi Al-Qur'an, dalam surat Al-Fiil.
                </p>

                {/* Tombol Watch & Like & Counter di Bawah Deskripsi */}
                <div className="mt-5 space-y-3 pt-4 border-t border-white/10">  
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleLikeOriginStory}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
                        hasLikedOrigin
                          ? "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30"
                          : "bg-white/10 text-white hover:bg-white/20 border border-white/10"
                      }`}
                    >
                      <span>{hasLikedOrigin ? "❤️" : "🤍"}</span>
                      <span>{hasLikedOrigin ? "Liked" : "Like"}</span>
                    </button>
                    <span className="text-sm text-gray-300 font-medium">
                      {originStoryLikes} Suka
                    </span>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>

        {/* Our Gallery */}
        <section className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-sm transition-all duration-300 hover:shadow-white/5">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h2 className="text-xl font-bold text-white">Our Gallery</h2>
                <p className="text-sm text-gray-400">Koleksi visual dari tim kami.</p>
            </div>
            <a
                href="/galery"
                className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
                Lebih Banyak
            </a>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-2">
            <div className="flex w-max animate-[gallery-scroll_20s_linear_infinite] items-center gap-4">
              {galleryImages.concat(galleryImages).map((image, index) => (
                  <div
                    key={`gallery-${index}`}
                    className="group relative h-40 sm:h-48 md:h-56 min-w-[160px] sm:min-w-[288px] md:min-w-[320px] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-all duration-500 hover:scale-105 hover:shadow-xl hover:shadow-white/10"
                  >
                    <img
                      src={image}
                      alt={`Gallery ${index + 1}`}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />
                  </div>
              ))}
            </div>
          </div>
        </section>

        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setActiveTab("film")}
            className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 ${
              activeTab === "film" 
                ? "bg-white text-black shadow-lg shadow-white/20 hover:shadow-white/40 hover:scale-105" 
                : "bg-white/5 text-white hover:bg-white/10 border border-white/10 hover:scale-105"
            }`}
          >
            🍿 Tonton Gratis Sekarang
          </button>
          <button
            onClick={() => setActiveTab("trailer")}
            className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 ${
              activeTab === "trailer" 
                ? "bg-white text-black shadow-lg shadow-white/20 hover:shadow-white/40 hover:scale-105" 
                : "bg-white/5 text-white hover:bg-white/10 border border-white/10 hover:scale-105"
            }`}
          >
            🎬 Khusus Pelanggan
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVideos.length === 0 ? (
            <div className="col-span-full bg-white/5 rounded-2xl border border-white/10 p-12 text-center transition-all duration-500 hover:shadow-lg hover:shadow-white/5">
              <div className="text-4xl mb-3 animate-bounce">🎬</div>
              <p className="text-gray-400 font-medium">
                Belum ada konten dalam kategori {activeTab === "film" ? "Playlist Teaser" : "Video"}.
              </p>
            </div>
          ) : (
            filteredVideos.map((v, index) => (
              <div
                key={v.id}
                className="group bg-white/5 rounded-2xl overflow-hidden border border-white/10 hover:shadow-2xl hover:shadow-white/10 transition-all duration-500 hover:-translate-y-2"
                style={{
                  animation: `fadeInUp 0.6s ease-out ${index * 0.1}s both`
                }}
              >
                <div>
                  <div 
                    onClick={() => handleWatchClick(v)} 
                    className="relative aspect-video w-full bg-black overflow-hidden cursor-pointer"
                  >
                    {v.thumbnail_url ? (
                      <img
                        src={v.thumbnail_url}
                        alt={v.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 bg-white/5 p-4">
                        <span className="text-4xl mb-1 animate-pulse">{v.type === "trailer" ? "🎬" : "🍿"}</span>
                        <span className="text-xs font-medium text-gray-500">No Poster Available</span>
                      </div>
                    )}

                    <div className="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-lg backdrop-blur-sm transition-all duration-300 ${
                        v.type === "trailer"
                          ? "bg-white/10 text-white border border-white/20"
                          : "bg-white/10 text-white border border-white/20"
                      }`}>
                        {v.type === "trailer" ? "🎬 Video" : `🍿 ${v.playlist_title || "Teaser"}`}
                      </span>

                      {v.is_premium && (
                        <span className="bg-white/10 text-white px-3 py-1 rounded-lg text-xs font-semibold backdrop-blur-sm flex items-center gap-1 border border-white/20 animate-pulse-slow">
                          🔒 Premium
                        </span>
                      )}
                    </div>

                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center text-2xl shadow-xl transform group-hover:scale-110 transition-all duration-300 hover:shadow-white/30">
                        ▶
                      </div>
                    </div>
                  </div>

                  <div className="p-5 space-y-2">
                    <h3 className="font-semibold text-lg text-white group-hover:text-gray-300 transition-colors line-clamp-1">
                      {v.title}
                    </h3>
                    <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed">
                      {v.description || "Tidak ada deskripsi."}
                    </p>
                  </div>
                </div>

                <div className="px-5 pb-5">
                  <button
                    onClick={() => handleWatchClick(v)}
                    className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                      !userId
                        ? "bg-white/5 text-gray-400 hover:bg-white/10 hover:scale-105 border border-white/10"
                        : !v.is_premium || profile?.is_premium || profile?.role === "admin"
                        ? v.type === "trailer"
                          ? "bg-white text-black hover:shadow-lg hover:shadow-white/30 hover:scale-105"
                          : "bg-white text-black hover:shadow-lg hover:shadow-white/30 hover:scale-105"
                        : "bg-white/5 text-white hover:bg-white/10 hover:scale-105 border border-white/10"
                    }`}
                  >
                    {!userId ? (
                      <>🔒 Login untuk Menonton</>
                    ) : !v.is_premium || profile?.is_premium || profile?.role === "admin" ? (
                      v.type === "trailer" ? "Tonton Video" : "Tonton Teaser Sekarang"
                    ) : (
                      <>🔒 Nonton Konten (Butuh Premium)</>
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <footer className="mt-10 rounded-3xl border border-white/10 bg-white/5 px-6 py-8 shadow-lg shadow-white/5 backdrop-blur-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <img
                src={logoImage.src}
                alt="IQROBOT logo"
                className="h-12 w-auto object-contain"
              />
              <div>
                <p className="text-sm text-gray-400">
                  Dukung IQROBOT
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
              <a
                href="https://wa.me/6285700415441"
                target="_blank"
                rel="noreferrer"
                className="transition hover:text-white"
              >
                WhatsApp
              </a>
              <a
                href="mailto:admin@iqrobot.id"
                className="transition hover:text-white"
              >
                Kontak
              </a>
              <Link href="/galery" className="transition hover:text-white">
                Galeri
              </Link>
            </div>
          </div>

          <div className="mt-6 border-t border-white/10 pt-4 text-sm text-gray-500">
            © 2026 IQROBOT.ID. Semua hak dilindungi.
          </div>
        </footer>
      </div>

      {showPremiumModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white/5 rounded-2xl p-6 space-y-4 text-center shadow-2xl border border-white/10 animate-in fade-in zoom-in duration-300 backdrop-blur-sm">
            <div className="mx-auto w-16 h-16 rounded-full bg-white/10 flex items-center justify-center animate-bounce border border-white/20">
              <span className="text-3xl">👑</span>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">Akses Terkunci!</h3>
              <p className="text-sm text-gray-400">
                Anda harus menjadi <span className="text-white font-semibold">Member Premium</span> untuk menonton konten ini.
              </p>
            </div>

            <div className="pt-2 space-y-2.5">
              <button
                onClick={handleUpgradeViaWhatsApp}
                className="w-full rounded-xl bg-white hover:shadow-xl hover:shadow-white/30 py-3 text-sm font-bold text-black transition-all duration-300 flex items-center justify-center gap-2 hover:scale-105"
              >
                💬 Upgrade via WhatsApp
              </button>

              <button
                onClick={() => setShowPremiumModal(false)}
                className="w-full rounded-xl bg-white/5 py-3 text-sm font-medium text-white hover:bg-white/10 transition-all duration-300 hover:scale-105 border border-white/10"
              >
                Nanti Saja
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-4xl bg-white/5 rounded-2xl overflow-hidden shadow-2xl border border-white/10 transform transition-all duration-500 animate-slide-up backdrop-blur-sm">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-white/5 to-transparent">
              <div>
                <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                  {selectedVideo.type === "trailer" ? "🎬 Preview Video" : "🍿 Full Teaser"}
                </span>
                <h3 className="text-lg font-bold text-white">{selectedVideo.title}</h3>
              </div>
              <button 
                onClick={() => setSelectedVideo(null)} 
                className="p-2 hover:bg-white/10 rounded-full transition-all duration-300 hover:rotate-90"
              >
                <span className="text-gray-400 hover:text-white text-xl">✕</span>
              </button>
            </div>

            <div className="relative aspect-video w-full overflow-hidden bg-black">
              <div 
                className="absolute top-0 right-0 w-24 h-16 z-20 bg-transparent cursor-default select-none" 
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
              />

              <iframe
                src={getEmbedUrl(selectedVideo.video_url)}
                className="absolute -top-12 left-0 w-full h-[calc(100%+52px)] border-0"
                allow="autoplay"
                allowFullScreen
              />
            </div>

            <div className="p-4 bg-gradient-to-r from-white/5 to-transparent">
              <p className="text-sm text-gray-400">{selectedVideo.description}</p>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes characterIdle {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(2deg); }
        }
        
        @keyframes float {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(30px, -30px) rotate(180deg); }
        }
        
        @keyframes float-delayed {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(-30px, 30px) rotate(-180deg); }
        }
        
        @keyframes spin-slow {
          from { transform: translate(-50%, -50%) rotate(0deg) scale(1); }
          to { transform: translate(-50%, -50%) rotate(360deg) scale(1.2); }
        }
        
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        @keyframes ping-slow {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(50px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        .animate-float {
          animation: float 20s ease-in-out infinite;
        }
        
        .animate-float-delayed {
          animation: float-delayed 25s ease-in-out infinite;
        }
        
        .animate-spin-slow {
          animation: spin-slow 30s linear infinite;
        }
        
        .animate-gradient-x {
          background-size: 200% 100%;
          animation: gradient-x 3s ease-in-out infinite;
        }
        
        .animate-ping-slow {
          animation: ping-slow 2s ease-out infinite;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }
        
        .animate-slide-in {
          animation: slide-in 0.6s ease-out both;
        }
        
        .animate-slide-in-delayed {
          animation: slide-in 0.6s ease-out 0.2s both;
        }
        
        .animate-slide-in-delayed-2 {
          animation: slide-in 0.6s ease-out 0.4s both;
        }
        
        .animate-fade-in {
          animation: fade-in 0.3s ease-out both;
        }
        
        .animate-slide-up {
          animation: slide-up 0.5s ease-out both;
        }
      `}</style>
    </div>
  );
}