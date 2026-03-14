export function CardSkeleton({ aspect = "video" }: { aspect?: "video" | "poster" }) {
  return (
    <div className="tvcw-card overflow-hidden animate-pulse">
      <div
        className={`shimmer bg-cyber-gray ${
          aspect === "poster" ? "aspect-[2/3]" : "aspect-video"
        }`}
      />
      <div className="p-3 flex flex-col gap-2">
        <div className="shimmer h-3 rounded bg-cyber-gray w-3/4" />
        <div className="shimmer h-3 rounded bg-cyber-gray w-1/2" />
      </div>
    </div>
  );
}

export function GridSkeleton({
  count = 12,
  aspect,
}: {
  count?: number;
  aspect?: "video" | "poster";
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} aspect={aspect} />
      ))}
    </div>
  );
}
