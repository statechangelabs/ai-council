import React from "react";
import { MessageSquare, Clock, Users, Settings } from "lucide-react";
import { cn } from "../lib/utils";
import { Separator } from "../ui/separator";
import type { Page } from "../App";

const navItems: { page: Page; label: string; icon: React.ElementType }[] = [
  { page: "discussion", label: "Discussion", icon: MessageSquare },
  { page: "history", label: "History", icon: Clock },
  { page: "counsellors", label: "Counsellors", icon: Users },
  { page: "settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <nav className="w-56 flex flex-col border-r bg-card">
      <div className="px-4 py-5">
        <h1 className="text-lg font-bold tracking-tight text-primary">AI Council</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Discussion orchestrator</p>
      </div>
      <Separator />
      <div className="flex flex-col gap-1 p-2 mt-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = currentPage === item.page;
          return (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
