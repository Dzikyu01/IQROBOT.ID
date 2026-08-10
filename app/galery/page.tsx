import Link from "next/link";

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

export default function GalleryPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-gray-400">Galeri Foto</p>
            <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
              Semua Foto Saya
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-gray-400 sm:text-base">
              Jelajahi seluruh koleksi foto roadshow dalam tampilan grid yang responsif.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Kembali ke Dashboard
          </Link>
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 shadow-lg shadow-white/5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {galleryImages.map((src, index) => (
              <div
                key={src}
                className="overflow-hidden rounded-3xl border border-white/10 bg-black/20 shadow-inner shadow-black/20 transition duration-300 hover:-translate-y-1 hover:shadow-white/10"
              >
                <img
                  src={src}
                  alt={`Foto gallery ${index + 1}`}
                  loading="lazy"
                  className="h-72 w-full object-cover transition duration-500 hover:scale-105 sm:h-80"
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
