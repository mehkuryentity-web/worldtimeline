import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Plus, User } from "lucide-react";

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items: { to: "/" | "/search" | "/submit" | "/profile"; label: string; icon: typeof Home; primary?: boolean }[] = [
    { to: "/", label: "Home", icon: Home },
    { to: "/search", label: "Search", icon: Search },
    { to: "/submit", label: "Add", icon: Plus, primary: true },
    { to: "/profile", label: "Profile", icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface-1/95 backdrop-blur supports-[backdrop-filter]:bg-surface-1/80">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
        {items.map(({ to, label, icon: Icon, primary }) => {
          const active = pathname === to;
          if (primary) {
            return (
              <Link
                key={to}
                to={to}
                className="-mt-6 flex flex-col items-center justify-center"
                aria-label={label}
              >
                <span className="grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground glow-primary">
                  <Icon className="h-6 w-6" strokeWidth={2.5} />
                </span>
                <span className="mt-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {label}
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={to}
              to={to}
              className="flex flex-1 flex-col items-center gap-1 py-1"
              aria-label={label}
            >
              <Icon
                className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`}
                strokeWidth={active ? 2.5 : 2}
              />
              <span
                className={`text-[10px] font-mono uppercase tracking-wider ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
