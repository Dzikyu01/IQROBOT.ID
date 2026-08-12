export default function GamePage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-4">Game Unity WebGL</h1>
      <div className="w-full max-w-4xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-gray-800">
        <iframe
          src="/game/index.html"
          className="w-full h-full border-none"
          title="Game"
        />
      </div>
    </div>
  );
}