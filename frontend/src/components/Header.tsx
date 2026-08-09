import { Rocket, ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router";

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const isResults = location.pathname.startsWith("/results");

  return (
    <header className="relative z-20 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur-sm sm:px-6">
      <div className="flex items-center gap-3">
        {isResults && (
          <button
            onClick={() => navigate("/")}
            aria-label="Back to upload"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20">
            <Rocket size={18} className="text-accent" />
          </div>
          <div>
            <h1 className="font-heading text-sm font-semibold tracking-wider text-foreground">
              LUNARSAFE AI
            </h1>
            <p className="text-[11px] leading-tight text-muted-foreground">
              Computer Vision Decision Support for Lunar Landing Analysis
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="hidden rounded-sm bg-primary/10 px-2 py-0.5 font-heading text-[11px] text-primary sm:inline-block">
          v0.2
        </span>
        <span className="relative flex h-2 w-2 items-center justify-center">
          <span className="h-2 w-2 animate-ping-slow rounded-full bg-success opacity-75" />
          <span className="absolute h-1 w-1 rounded-full bg-success" />
        </span>
      </div>
    </header>
  );
}