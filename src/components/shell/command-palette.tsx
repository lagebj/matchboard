"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Users,
  Trophy,
  Calendar,
  Flag,
  Settings,
  Plus,
  LayoutDashboard,
  ArrowRight,
  Command,
  Building2,
  FlaskConical,
  Wrench,
} from "lucide-react";
import { useOrgSlug } from "@/components/shell/org-slug-context";

type CommandItem = {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  href?: string;
  action?: () => void;
  category: "navigate" | "create" | "search" | "switch" | "admin";
  keywords: string[];
};

type OrganisationOption = {
  id: string;
  name: string;
  slug: string;
  role: string;
  isCurrent: boolean;
};

type CommandPaletteData = {
  currentOrganisation: { id: string; name: string; slug: string } | null;
  organisations: OrganisationOption[];
  commands: { id: string; label: string; description?: string; href: string; category: string; keywords: string[] }[];
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  navigate: <LayoutDashboard className="h-4 w-4" />,
  create: <Plus className="h-4 w-4" />,
  switch: <Building2 className="h-4 w-4" />,
  admin: <Wrench className="h-4 w-4" />,
  search: <Search className="h-4 w-4" />,
};

const CATEGORY_LABELS: Record<string, string> = {
  navigate: "Navigate",
  create: "Create",
  switch: "Switch organisation",
  admin: "Admin",
  search: "Search",
};

type SearchResult = {
  players: { id: string; name: string; coreTeamName: string }[];
  teams: { id: string; name: string }[];
};

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const orgSlug = useOrgSlug();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [paletteData, setPaletteData] = useState<CommandPaletteData | null>(null);
  const searchSeqRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        e.stopPropagation();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSearchResults(null);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
      fetch("/api/command-palette")
        .then((r) => r.json())
        .then(setPaletteData)
        .catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    const seq = ++searchSeqRef.current;
    const timer = setTimeout(() => {
      fetch(`/api/context?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((data) => {
          if (seq === searchSeqRef.current) setSearchResults(data);
        })
        .catch(() => {});
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const staticCommands: CommandItem[] = (paletteData?.commands ?? []).map((cmd) => ({
    ...cmd,
    icon: CATEGORY_ICONS[cmd.category] ?? <ArrowRight className="h-4 w-4" />,
    category: cmd.category as CommandItem["category"],
  }));

  const orgItems: CommandItem[] = (paletteData?.organisations ?? [])
    .filter((o) => !o.isCurrent)
    .map((o) => ({
      id: `org-${o.slug}`,
      label: o.name,
      description: `Switch to ${o.name} (${o.role})`,
      icon: <Building2 className="h-4 w-4" />,
      href: `/o/${o.slug}/attention`,
      category: "switch" as const,
      keywords: [o.name, o.slug, "organisation", "switch"],
    }));

  const allStaticItems = [...orgItems, ...staticCommands];

  const filteredCommands = query.trim().length === 0
    ? allStaticItems
    : allStaticItems.filter((cmd) => {
        const q = query.toLowerCase();
        return (
          cmd.label.toLowerCase().includes(q) ||
          cmd.description?.toLowerCase().includes(q) ||
          cmd.keywords.some((k) => k.includes(q))
        );
      });

  const searchItems: CommandItem[] = (searchResults?.players ?? []).map((p) => ({
    id: `player-${p.id}`,
    label: p.name,
    description: p.coreTeamName,
    icon: <Users className="h-4 w-4" />,
    href: `/o/${orgSlug}/players/${p.id}`,
    category: "search" as const,
    keywords: [p.name, p.coreTeamName],
  }));

  const teamItems: CommandItem[] = (searchResults?.teams ?? []).map((t) => ({
    id: `team-${t.id}`,
    label: t.name,
    icon: <Trophy className="h-4 w-4" />,
    href: `/o/${orgSlug}/teams/${t.id}`,
    category: "search" as const,
    keywords: [t.name],
  }));

  const allItems =
    query.trim().length >= 2
      ? [...searchItems, ...teamItems, ...filteredCommands]
      : filteredCommands;

  const totalItems = allItems.length;
  const clampedIndex = Math.min(selectedIndex, Math.max(totalItems - 1, 0));

  const handleSelect = useCallback(
    (item: CommandItem) => {
      onOpenChange(false);
      if (item.href) {
        router.push(item.href);
      } else if (item.action) {
        item.action();
      }
    },
    [router, onOpenChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, totalItems - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && allItems[clampedIndex]) {
      handleSelect(allItems[clampedIndex]);
    } else if (e.key === "Escape") {
      onOpenChange(false);
    }
  };

  if (!open) return null;

  const groupedCategories = query.trim().length === 0
    ? [
        ...(orgItems.length > 0 ? [{ label: "Switch organisation", items: orgItems }] : []),
        { label: "Create", items: allStaticItems.filter((i) => i.category === "create") },
        { label: "Navigate", items: allStaticItems.filter((i) => i.category === "navigate") },
        { label: "Admin", items: allStaticItems.filter((i) => i.category === "admin") },
      ]
    : [
        ...(searchItems.length > 0 ? [{ label: "Players", items: searchItems }] : []),
        ...(teamItems.length > 0 ? [{ label: "Teams", items: teamItems }] : []),
        ...(filteredCommands.filter((i) => i.category === "switch").length > 0 ? [{ label: "Switch organisation", items: filteredCommands.filter((i) => i.category === "switch") }] : []),
        ...(filteredCommands.filter((i) => i.category === "create").length > 0 ? [{ label: "Create", items: filteredCommands.filter((i) => i.category === "create") }] : []),
        ...(filteredCommands.filter((i) => i.category === "navigate" || i.category === "admin").length > 0 ? [{ label: "Commands", items: filteredCommands.filter((i) => i.category === "navigate" || i.category === "admin") }] : []),
      ];

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="fixed inset-x-4 top-[12vh] mx-auto max-w-lg sm:top-[15vh]">
        <div className="overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--surface-raised)] shadow-2xl">
          <div className="flex items-center gap-2 border-b border-[var(--border-soft)] px-3">
            <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
            <input
              ref={inputRef}
              type="text"
              aria-label="Search commands, players, and teams"
              placeholder="Search commands, players, teams…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              className="h-10 flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-[var(--text-disabled)] focus:outline-none"
            />
            <kbd className="hidden rounded border border-[var(--border-soft)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-muted)] sm:inline-block">
              Esc
            </kbd>
          </div>
          <div className="max-h-[50vh] overflow-y-auto p-1.5">
            {allItems.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-[var(--text-muted)]">
                No results found
              </p>
            )}
            {groupedCategories.map((group) =>
              group.items.length > 0 ? (
                <div key={group.label}>
                  <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    {group.label}
                  </p>
                  {group.items.map((item) => {
                    const idx = allItems.indexOf(item);
                    const isActive = idx === clampedIndex;
                    return (
                      <Link
                        key={item.id}
                        href={item.href ?? "#"}
                        onClick={(e) => {
                          e.preventDefault();
                          handleSelect(item);
                        }}
                        className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                          isActive
                            ? "bg-[var(--surface-hover)] text-zinc-50"
                            : "text-zinc-300 hover:bg-[var(--surface-hover)] hover:text-zinc-50"
                        }`}
                      >
                        <span className="shrink-0 text-[var(--text-muted)]">{item.icon}</span>
                        <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                        {item.description && (
                          <span className="hidden shrink-0 text-[var(--text-muted)] sm:inline">
                            {item.description}
                          </span>
                        )}
                        {isActive && (
                          <ArrowRight className="h-3 w-3 shrink-0 text-[var(--text-muted)]" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              ) : null
            )}
          </div>
          <div className="border-t border-[var(--border-soft)] px-3 py-2">
            <p className="text-[10px] text-[var(--text-disabled)]">
              <kbd className="rounded border border-[var(--border-soft)] px-1 py-0.5 font-mono">↑↓</kbd>{" "}
              navigate{" "}
              <kbd className="rounded border border-[var(--border-soft)] px-1 py-0.5 font-mono">↵</kbd>{" "}
              select{" "}
              <kbd className="rounded border border-[var(--border-soft)] px-1 py-0.5 font-mono">esc</kbd>{" "}
              close
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CommandPaletteTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 px-3 text-xs text-[var(--text-soft)] transition-colors hover:border-[var(--accent)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/55"
      aria-label="Open command palette"
    >
      <Search className="h-3.5 w-3.5 text-[var(--text-muted)]" />
      <span className="hidden sm:inline">Search…</span>
      <kbd className="ml-1 hidden items-center gap-0.5 rounded border border-[var(--border-soft)] px-1 py-0.5 text-[10px] font-mono text-[var(--text-muted)] lg:inline-flex">
        <Command className="h-2.5 w-2.5" />K
      </kbd>
    </button>
  );
}