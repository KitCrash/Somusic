import { Compass, Home, Library, Search } from "lucide-react";
import { useUI } from "../stores/ui";

export function MobileBottomNav() {
  const view = useUI((s) => s.view);
  const navigate = useUI((s) => s.navigate);

  const tabs = [
    { id: "home", label: "Home", icon: Home, active: view.name === "home" },
    { id: "explore", label: "Explore", icon: Compass, active: view.name === "explore" || view.name === "mood" },
    { id: "search", label: "Search", icon: Search, active: view.name === "search" },
    { id: "library", label: "Library", icon: Library, active: view.name === "library" || view.name === "liked" || view.name === "playlist" },
  ];

  return (
    <nav className="md:hidden flex items-center justify-around h-16 bg-black/85 backdrop-blur-2xl border-t border-white/[0.08] px-2 z-40 select-none pb-[env(safe-area-inset-bottom,0px)]">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => navigate({ name: tab.id as any })}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 transition-colors duration-150 ${
              tab.active ? "text-white font-semibold" : "text-white/50 hover:text-white/80"
            }`}
          >
            <div className={`p-1 rounded-full transition-transform ${tab.active ? "scale-110" : ""}`}>
              <Icon size={22} className={tab.active ? "stroke-[2.5px] text-white" : "stroke-2"} />
            </div>
            <span className="text-[11px] tracking-tight">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
