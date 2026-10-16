"use client";

export interface SpotifyPillProps {
  track?: string;
}

export default function SpotifyPill({ track = "Listening on Spotify" }: Readonly<SpotifyPillProps>) {
  return (
    <div data-push className="flex cursor-pointer items-center gap-3 rounded-full border border-white/10 bg-[#141414] px-4 py-2 text-xs shadow-sm transition-all hover:border-white/25">
      <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.31c-.218.358-.684.474-1.042.256-2.855-1.745-6.447-2.14-10.68-1.171-.41.094-.82-.162-.914-.572-.094-.41.162-.82.572-.914 4.637-1.06 8.604-.616 11.808 1.345.358.218.474.684.256 1.056zm1.47-3.266c-.275.448-.86.59-1.308.315-3.268-2.008-8.25-2.59-12.115-1.417-.502.152-1.037-.134-1.19-.636-.152-.502.134-1.037.636-1.19 4.417-1.34 9.907-.69 13.662 1.62.448.275.59.86.315 1.308zm.126-3.41c-3.92-2.327-10.384-2.542-14.135-1.403-.6.182-1.24-.162-1.422-.762-.182-.6.162-1.24.762-1.422 4.309-1.308 11.455-1.056 15.962 1.62.54.32.716 1.02.396 1.56-.32.54-1.02.716-1.563.407z" />
      </svg>
      <span className="font-medium tracking-tight text-[#F2EDE4]">{track}</span>
      <div className="ml-1 flex h-4 items-end gap-1">
        <span className="wave-bar-1 w-[2.5px] rounded-full bg-white" />
        <span className="wave-bar-2 w-[2.5px] rounded-full bg-white" />
        <span className="wave-bar-3 w-[2.5px] rounded-full bg-white" />
        <span className="wave-bar-4 w-[2.5px] rounded-full bg-white" />
      </div>
    </div>
  );
}
