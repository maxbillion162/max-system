"use client";

import { useState } from "react";
import { HudCard } from "@/components/ui/HudCard";

const INIT = [
  { id:1, label:"Up by 7:30 AM",      cat:"Morning", color:"#ec4899", streak:0,  best:5,  h:[false,false,true,true,true,false,false] },
  { id:2, label:"Gym",                cat:"Health",  color:"#10b981", streak:12, best:18, h:[true,true,false,true,true,true,true] },
  { id:3, label:"Workout logged",     cat:"Health",  color:"#06b6d4", streak:4,  best:12, h:[false,true,false,true,true,true,true] },
  { id:4, label:"Read / Learn 30 min",cat:"Learning",color:"#f97316", streak:3,  best:14, h:[true,true,false,false,true,true,true] },
  { id:5, label:"Phone off by 11 PM", cat:"Sleep",   color:"#8b5cf6", streak:1,  best:7,  h:[false,true,false,true,false,false,true] },
  { id:6, label:"Hit protein goal",   cat:"Nutrition",color:"#10b981",streak:2,  best:9,  h:[true,false,false,true,false,true,true] },
];

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

export default function HabitsPage() {
  const [habits, setHabits] = useState(INIT);

  function toggle(id: number) {
    setHabits(p => p.map(h => {
      if (h.id !== id) return h;
      const nh = [...h.h]; nh[6] = !nh[6];
      return { ...h, h: nh, streak: nh[6] ? h.streak + 1 : Math.max(0, h.streak - 1) };
    }));
  }

  const done  = habits.filter(h => h.h[6]).length;
  const total = habits.length;
  const pct   = Math.round((done / total) * 100);
  const C     = 2 * Math.PI * 48;
  const dash  = C - (pct / 100) * C;

  return (
    <div className="grid-bg min-h-screen" style={{ padding: "40px 48px" }}>
      <div style={{ maxWidth: 900 }}>

        <div className="mb-8 afu">
          <p className="text-sm font-semibold tracking-widest uppercase mb-2" style={{ color: "var(--teal)", opacity: .6 }}>Habits & Health</p>
          <h1 className="text-4xl font-black tracking-tight mb-2 grad-text">Daily Discipline</h1>
          <p className="text-base" style={{ color: "var(--t2)" }}>Build the identity. The results follow.</p>
        </div>

        {/* Today card */}
        <HudCard className="p-7 mb-6" delay={.05}>
          <div className="flex items-center gap-10">
            <div className="flex-shrink-0">
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(6,182,212,0.07)" strokeWidth="6" />
                <circle cx="60" cy="60" r="48" fill="none"
                  stroke={pct === 100 ? "var(--green)" : "var(--teal)"} strokeWidth="6"
                  strokeDasharray={C} strokeDashoffset={dash} strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                  style={{ filter: `drop-shadow(0 0 10px ${pct===100?"var(--green)":"var(--teal)"})`, transition: "stroke-dashoffset .6s ease" }} />
                <text x="60" y="55" textAnchor="middle" fontSize="24" fontWeight="900" fill="var(--t1)">{done}</text>
                <text x="60" y="76" textAnchor="middle" fontSize="13" fill="var(--t3)">of {total}</text>
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-3xl font-black mb-2" style={{ color: "var(--t1)" }}>
                {pct === 100 ? "Perfect day. 🔥" : done === 0 ? "Let's get going." : `${total - done} habits left.`}
              </h2>
              <p className="text-base mb-5" style={{ color: "var(--t2)" }}>
                {pct >= 80 ? "Strong day. Close it out." : "Still time. Go."}
              </p>
              <div className="flex gap-8">
                <div>
                  <p className="text-sm font-semibold tracking-widest uppercase mb-1" style={{ color: "var(--t3)" }}>Today</p>
                  <p className="text-3xl font-black" style={{ color: "var(--teal)" }}>{pct}%</p>
                </div>
                <div style={{ borderLeft: "1px solid rgba(6,182,212,0.08)", paddingLeft: "2rem" }}>
                  <p className="text-sm font-semibold tracking-widest uppercase mb-1" style={{ color: "var(--t3)" }}>Best Streak</p>
                  <p className="text-3xl font-black" style={{ color: "var(--orange)" }}>
                    🔥 {Math.max(...habits.map(h => h.best))}
                  </p>
                </div>
                <div style={{ borderLeft: "1px solid rgba(6,182,212,0.08)", paddingLeft: "2rem" }}>
                  <p className="text-sm font-semibold tracking-widest uppercase mb-1" style={{ color: "var(--t3)" }}>7-Day Rate</p>
                  <p className="text-3xl font-black" style={{ color: "var(--green)" }}>
                    {Math.round(habits.reduce((a, h) => a + h.h.filter(Boolean).length, 0) / (habits.length * 7) * 100)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </HudCard>

        {/* Habits table */}
        <HudCard className="overflow-hidden mb-5" delay={.1}>
          <div className="grid px-7 py-4 text-sm font-semibold tracking-widest uppercase"
            style={{
              gridTemplateColumns: "1fr 160px 100px 72px",
              background: "rgba(6,182,212,0.03)",
              borderBottom: "1px solid rgba(6,182,212,0.07)",
              color: "var(--t3)"
            }}>
            <div>Habit</div>
            <div className="text-center">Last 7 Days</div>
            <div className="text-center">Streak</div>
            <div className="text-center">Today</div>
          </div>

          {habits.map((habit, i) => (
            <div key={habit.id}
              className="grid px-7 py-5 items-center transition-colors duration-150 hover:bg-white/[0.01]"
              style={{
                gridTemplateColumns: "1fr 160px 100px 72px",
                borderBottom: i < habits.length - 1 ? "1px solid rgba(6,182,212,0.05)" : "none",
              }}>

              <div>
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: habit.color, boxShadow: `0 0 6px ${habit.color}` }} />
                  <span className="text-base font-semibold" style={{ color: "var(--t1)" }}>{habit.label}</span>
                </div>
                <div className="text-sm mt-0.5 ml-4.5" style={{ color: "var(--t3)" }}>{habit.cat}</div>
              </div>

              <div className="flex items-center gap-1.5 justify-center">
                {habit.h.map((d, di) => (
                  <div key={di} title={DAYS[di]}
                    className="w-5 h-5 rounded flex items-center justify-center"
                    style={{
                      background: d ? `${habit.color}18` : "rgba(6,182,212,0.04)",
                      border: `1px solid ${d ? habit.color + "45" : "rgba(6,182,212,0.07)"}`,
                    }}>
                    {d && <div className="w-2 h-2 rounded-full" style={{ background: habit.color }} />}
                  </div>
                ))}
              </div>

              <div className="text-center">
                {habit.streak > 0
                  ? <span className="text-base font-bold" style={{ color: "var(--orange)" }}>🔥 {habit.streak}</span>
                  : <span className="text-base" style={{ color: "var(--t3)" }}>—</span>}
              </div>

              <div className="flex justify-center">
                <button onClick={() => toggle(habit.id)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                  style={{
                    background: habit.h[6] ? `${habit.color}15` : "rgba(6,182,212,0.04)",
                    border: `1.5px solid ${habit.h[6] ? habit.color + "50" : "rgba(6,182,212,0.1)"}`,
                    boxShadow: habit.h[6] ? `0 0 12px ${habit.color}30` : "none"
                  }}>
                  {habit.h[6] && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={habit.color} strokeWidth="3.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          ))}
        </HudCard>

        {/* Workout split */}
        <HudCard className="p-7" delay={.15}>
          <h2 className="text-xl font-bold mb-5" style={{ color: "var(--t1)" }}>Push · Pull · Legs Split</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { name: "Push",  detail: "Chest · Triceps · Shoulders", color: "#06b6d4",  note: "Mon / Thu" },
              { name: "Pull",  detail: "Back · Biceps",               color: "#10b981",  note: "Tue / Fri" },
              { name: "Legs",  detail: "Quads · Hamstrings · Glutes", color: "#8b5cf6",  note: "Wed / Sat" },
            ].map(d => (
              <div key={d.name} className="p-5 rounded-xl text-center"
                style={{ background: `${d.color}06`, border: `1px solid ${d.color}15` }}>
                <div className="text-xl font-black mb-1" style={{ color: d.color }}>{d.name}</div>
                <div className="text-sm mb-2" style={{ color: "var(--t2)" }}>{d.detail}</div>
                <div className="text-xs font-semibold" style={{ color: "var(--t3)" }}>{d.note}</div>
              </div>
            ))}
          </div>
        </HudCard>
      </div>
    </div>
  );
}
