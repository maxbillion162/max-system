"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmailBriefing }    from "@/components/email/EmailBriefing";
import { FolderRail }       from "@/components/email/FolderRail";
import { EmailList }        from "@/components/email/EmailList";
import { EmailDetail }      from "@/components/email/EmailDetail";
import { ReplyDrawer }      from "@/components/email/ReplyDrawer";
import { ComposeModal }     from "@/components/email/ComposeModal";
import { SnoozeMenu }       from "@/components/email/SnoozeMenu";
import { ReclassifyMenu }   from "@/components/email/ReclassifyMenu";
import { RulesModal }       from "@/components/email/RulesModal";
import { ShortcutsModal }   from "@/components/email/ShortcutsModal";
import type { FolderId }    from "@/components/email/FolderRail";
import type { EmailIntel, ThreadMessage, EmailClassification } from "@/components/email/types";
import { MONO, parseSenderField } from "@/components/email/types";

/* ────────── Page ────────── */
export default function EmailPage() {
  const [threads, setThreads]         = useState<EmailIntel[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [connected, setConnected]     = useState<boolean | null>(null);
  const [folder, setFolder]           = useState<FolderId>("all");
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [search, setSearch]           = useState("");
  const [latestMsg, setLatestMsg]     = useState<ThreadMessage | null>(null);

  /* Modals + drawers */
  const [composeOpen, setComposeOpen]       = useState(false);
  const [composeInitial, setComposeInitial] = useState<{ to?: string; subject?: string; body?: string; threadId?: string; inReplyTo?: string } | null>(null);
  const [replyOpen, setReplyOpen]           = useState(false);
  const [replyMsg, setReplyMsg]             = useState<ThreadMessage | null>(null);
  const [snoozeOpen, setSnoozeOpen]         = useState(false);
  const [reclassifyOpen, setReclassifyOpen] = useState(false);
  const [rulesOpen, setRulesOpen]           = useState(false);
  const [shortcutsOpen, setShortcutsOpen]   = useState(false);

  const searchRef = useRef<HTMLInputElement | null>(null);

  /* ───── Loading ───── */
  async function loadIntel() {
    try {
      const res = await fetch("/api/email/intel");
      const json = await res.json();
      if (Array.isArray(json.threads)) {
        setThreads(json.threads);
        setConnected(json.threads.length > 0 ? true : connected);
      }
    } finally {
      setLoading(false);
    }
  }

  async function refreshFromGmail() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/email/intel", { method: "POST" });
      const json = await res.json();
      if (json.error) {
        if (json.error.includes("not connected")) setConnected(false);
      } else {
        setConnected(true);
      }
      await loadIntel();
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadIntel();
    /* If we have no rows on first load, kick a refresh from Gmail in the background */
    void (async () => {
      const res = await fetch("/api/email/intel");
      const json = await res.json();
      if ((json.threads ?? []).length === 0) {
        void refreshFromGmail();
      }
    })();
  }, []);

  /* ───── Filtering ───── */
  const folderFiltered = useMemo(() => {
    return threads.filter(t => {
      if (folder === "all")        return !t.archived;
      if (folder === "starred")    return t.starred;
      if (folder === "snoozed")    return t.snooze_until && new Date(t.snooze_until) > new Date();
      if (folder === "archived")   return t.archived;
      return !t.archived && t.classification === folder;
    });
  }, [threads, folder]);

  const counts = useMemo(() => {
    const c = { all: 0, action: 0, waiting: 0, newsletter: 0, fyi: 0, noise: 0, starred: 0, snoozed: 0, archived: 0 };
    const now = Date.now();
    for (const t of threads) {
      if (t.archived) { c.archived++; continue; }
      if (t.snooze_until && new Date(t.snooze_until).getTime() > now) { c.snoozed++; continue; }
      c.all++;
      if (t.classification && t.classification in c) c[t.classification as keyof typeof c]++;
      if (t.starred) c.starred++;
    }
    return c;
  }, [threads]);

  const selected = useMemo(() => threads.find(t => t.thread_id === selectedId) ?? null, [threads, selectedId]);

  /* Auto-select first if nothing chosen */
  useEffect(() => {
    if (!selectedId && folderFiltered.length > 0) {
      setSelectedId(folderFiltered[0].thread_id);
    }
  }, [folderFiltered, selectedId]);

  /* When a thread is selected, mark it read */
  useEffect(() => {
    if (!selected || !selected.unread) return;
    void fetch("/api/email/intel-actions", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ thread_id: selected.thread_id, unread: false }),
    });
    setThreads(prev => prev.map(t => t.thread_id === selected.thread_id ? { ...t, unread: false } : t));
  }, [selected?.thread_id]);

  /* ───── Actions ───── */
  function localPatch(thread_id: string, patch: Partial<EmailIntel>) {
    setThreads(prev => prev.map(t => t.thread_id === thread_id ? { ...t, ...patch } : t));
  }

  async function archiveToggle() {
    if (!selected) return;
    const next = !selected.archived;
    localPatch(selected.thread_id, { archived: next });
    await fetch("/api/email/intel-actions", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ thread_id: selected.thread_id, archived: next }),
    });
    /* Step to next thread in list */
    const idx = folderFiltered.findIndex(t => t.thread_id === selected.thread_id);
    const nextThread = folderFiltered[idx + 1] ?? folderFiltered[idx - 1] ?? null;
    setSelectedId(nextThread?.thread_id ?? null);
  }

  async function starToggle() {
    if (!selected) return;
    const next = !selected.starred;
    localPatch(selected.thread_id, { starred: next });
    await fetch("/api/email/intel-actions", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ thread_id: selected.thread_id, starred: next }),
    });
  }

  async function applySnooze(date: Date) {
    if (!selected) return;
    setSnoozeOpen(false);
    localPatch(selected.thread_id, { snooze_until: date.toISOString() });
    await fetch("/api/email/snooze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ thread_id: selected.thread_id, snooze_until: date.toISOString() }),
    });
    /* Step to next */
    const idx = folderFiltered.findIndex(t => t.thread_id === selected.thread_id);
    const nextThread = folderFiltered[idx + 1] ?? folderFiltered[idx - 1] ?? null;
    setSelectedId(nextThread?.thread_id ?? null);
  }

  async function applyReclassify(
    newClass: EmailClassification,
    makeRule: boolean,
    ruleSpec?: { type: "sender_email" | "sender_domain" | "subject_contains"; value: string; name: string },
  ) {
    if (!selected) return;
    localPatch(selected.thread_id, {
      classification:        newClass,
      classification_source: "manual",
      action_required:       newClass === "action",
    });
    await fetch("/api/email/reclassify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        thread_id:           selected.thread_id,
        new_classification:  newClass,
        make_rule:           makeRule,
        rule_condition_type: ruleSpec?.type,
        rule_condition_value:ruleSpec?.value,
        rule_name:           ruleSpec?.name,
      }),
    });
    /* If rule was created, reload intel so retro-applied rows refresh */
    if (makeRule) await loadIntel();
  }

  function openReply(msg: ThreadMessage) {
    setReplyMsg(msg);
    setReplyOpen(true);
  }
  function openForward(msg: ThreadMessage) {
    const sender = parseSenderField(msg.from);
    setComposeInitial({
      to:        "",
      subject:   msg.subject.toLowerCase().startsWith("fwd:") ? msg.subject : `Fwd: ${msg.subject}`,
      body:      `\n\n----- Forwarded message -----\nFrom: ${sender.name} <${sender.email}>\nDate: ${msg.date}\nSubject: ${msg.subject}\n\n${msg.body || msg.snippet}`,
    });
    setComposeOpen(true);
  }
  function openCompose() {
    setComposeInitial(null);
    setComposeOpen(true);
  }

  /* ───── Keyboard shortcuts ───── */
  const handleKey = useCallback((e: KeyboardEvent) => {
    /* Don't intercept when typing into inputs/textareas, except universal: ESC + ?. */
    const target = e.target as HTMLElement;
    const inField = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
    if (e.key === "Escape") {
      setShortcutsOpen(false);
      if (replyOpen)     setReplyOpen(false);
      if (composeOpen)   setComposeOpen(false);
      if (snoozeOpen)    setSnoozeOpen(false);
      if (reclassifyOpen)setReclassifyOpen(false);
      if (rulesOpen)     setRulesOpen(false);
      return;
    }
    if (inField) return;
    /* Don't fire when a modal is open */
    if (replyOpen || composeOpen || snoozeOpen || reclassifyOpen || rulesOpen) return;

    const idx = folderFiltered.findIndex(t => t.thread_id === selected?.thread_id);
    switch (e.key) {
      case "j": case "ArrowDown":
        e.preventDefault();
        if (idx < folderFiltered.length - 1) setSelectedId(folderFiltered[idx + 1].thread_id);
        break;
      case "k": case "ArrowUp":
        e.preventDefault();
        if (idx > 0) setSelectedId(folderFiltered[idx - 1].thread_id);
        break;
      case "r":
        if (latestMsg) { e.preventDefault(); openReply(latestMsg); }
        break;
      case "c": case "n":
        e.preventDefault(); openCompose();
        break;
      case "e":
        if (selected) { e.preventDefault(); void archiveToggle(); }
        break;
      case "s":
        if (selected) { e.preventDefault(); setSnoozeOpen(true); }
        break;
      case "t":
        if (selected) { e.preventDefault(); setReclassifyOpen(true); }
        break;
      case "*":
        if (selected) { e.preventDefault(); void starToggle(); }
        break;
      case "/":
        e.preventDefault(); searchRef.current?.focus();
        break;
      case "?":
        e.preventDefault(); setShortcutsOpen(v => !v);
        break;
    }
  }, [folderFiltered, selected, latestMsg, replyOpen, composeOpen, snoozeOpen, reclassifyOpen, rulesOpen]);

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  /* ───── Render ───── */
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg)", overflow: "hidden" }}>

      {/* Briefing strip */}
      <div style={{ padding: "12px 16px 0" }}>
        <EmailBriefing onSelectThread={(id) => { setSelectedId(id); setFolder("all"); }} />
      </div>

      {/* Main 3-column area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", padding: "12px 16px 14px", gap: 0 }}>
        <div style={{
          flex: 1, display: "flex", overflow: "hidden",
          border: "1px solid var(--border)", borderRadius: 3,
        }}>
          <FolderRail
            active={folder}
            onChange={setFolder}
            counts={counts}
            connected={connected ?? false}
            onRulesClick={() => setRulesOpen(true)}
            onComposeClick={openCompose}
            onShortcuts={() => setShortcutsOpen(true)}
            onRefresh={refreshFromGmail}
            refreshing={refreshing}
          />
          <EmailList
            threads={folderFiltered}
            selectedId={selectedId}
            onSelect={setSelectedId}
            search={search}
            onSearch={setSearch}
            searchInputRef={searchRef}
            loading={loading}
            emptyHint={
              folder === "action"     ? "Nothing needs action right now."
              : folder === "waiting"  ? "You're not waiting on anyone."
              : folder === "snoozed"  ? "No snoozed threads."
              : folder === "archived" ? "Nothing archived yet."
              : connected === false   ? "Gmail not connected — connect from /dashboard/settings."
              : undefined
            }
          />
          <EmailDetail
            thread={selected}
            onReply={openReply}
            onForward={openForward}
            onArchiveToggle={archiveToggle}
            onStarToggle={starToggle}
            onSnoozeRequest={() => setSnoozeOpen(true)}
            onReclassify={() => setReclassifyOpen(true)}
            onLatestMessage={setLatestMsg}
          />
        </div>
      </div>

      {/* Footer hint bar */}
      <div style={{
        padding: "6px 24px", borderTop: "1px solid var(--border)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontFamily: MONO, fontSize: 9, color: "var(--t4)", letterSpacing: "0.18em",
        background: "var(--surface)",
      }}>
        <span>
          {threads.length} THREADS · {counts.action} ACTION · {counts.waiting} WAITING
          {counts.snoozed > 0 && ` · ${counts.snoozed} SNOOZED`}
        </span>
        <span>J/K NAVIGATE · R REPLY · C COMPOSE · E ARCHIVE · S SNOOZE · T RECLASSIFY · ? HELP</span>
      </div>

      {/* Drawers + modals */}
      {replyOpen && selected && replyMsg && (
        <ReplyDrawer
          thread={selected}
          message={replyMsg}
          onClose={() => setReplyOpen(false)}
          onSent={() => { setReplyOpen(false); void refreshFromGmail(); }}
        />
      )}

      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSent={() => { setComposeOpen(false); void refreshFromGmail(); }}
        initial={composeInitial ?? undefined}
      />

      {snoozeOpen && selected && (
        <SnoozeMenu open={snoozeOpen} onClose={() => setSnoozeOpen(false)} onPick={applySnooze} />
      )}

      {reclassifyOpen && selected && (
        <ReclassifyMenu
          thread={selected}
          onClose={() => setReclassifyOpen(false)}
          onSubmit={applyReclassify}
        />
      )}

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
