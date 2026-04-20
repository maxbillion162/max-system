"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <main
        className="flex-1 overflow-auto"
        style={{
          marginLeft: collapsed ? 56 : 224,
          transition: "margin-left 0.25s ease",
        }}
      >
        {children}
      </main>
    </div>
  );
}
