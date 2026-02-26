import React, { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { DiscussionPage } from "./pages/DiscussionPage";
import { CounsellorsPage } from "./pages/CounsellorsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { SettingsPage } from "./pages/SettingsPage";

export type Page = "discussion" | "history" | "counsellors" | "settings";

export function App() {
  const [page, setPage] = useState<Page>("discussion");

  return (
    <div className="flex h-screen bg-background">
      <Sidebar currentPage={page} onNavigate={setPage} />
      <main className="flex-1 overflow-hidden">
        {page === "discussion" && <DiscussionPage />}
        {page === "history" && <HistoryPage />}
        {page === "counsellors" && <CounsellorsPage />}
        {page === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}
