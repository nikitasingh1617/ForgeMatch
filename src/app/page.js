"use client";
import Sidebar from "./components/Sidebar";
import { useState, useEffect, useMemo, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Sparkles,
  Trophy,
  Users,
  BarChart3,
  TrendingUp,
  Zap,
  Clock,
  CheckCircle2,
  Star,
  Award,
  Brain,
  Target,
  UserCheck,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  Legend,
} from "recharts";

// ─── Configuration ───────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const DASHBOARD_CACHE_TTL_MS = 60000; // 1 minute

// ─── Helper Components ────────────────────────────────────────────
function Counter({ target, suffix = "", duration = 1200 }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const id = setInterval(() => {
      start = Math.min(start + step, target);
      setVal(start);
      if (start >= target) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [target, duration]);
  return <>{val}{suffix}</>;
}

function SkeletonKpi() {
  return (
    <div className="relative rounded-2xl p-6 min-h-[180px] bg-gray-50 border border-gray-200 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="w-14 h-14 rounded-xl bg-gray-200" />
        <div className="w-5 h-5 rounded-full bg-gray-200" />
      </div>
      <div className="mt-5 h-8 w-3/4 rounded bg-gray-200" />
      <div className="mt-2 h-4 w-1/2 rounded bg-gray-200" />
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, suffix = "", sub, accent, delay = 0, loading = false }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setVisible(true), delay);
      return () => clearTimeout(t);
    }
  }, [loading, delay]);

  const accents = {
    blue: { grad: "from-blue-600 via-blue-500 to-indigo-500", glow: "rgba(37,99,235,0,0.28)", text: "text-blue-600", border: "border-blue-500" },
    violet: { grad: "from-violet-500 to-violet-600", glow: "rgba(124,58,237,0.15)", text: "text-violet-600", border: "border-violet-500" },
    cyan: { grad: "from-cyan-400 to-cyan-600", glow: "rgba(6,182,212,0.15)", text: "text-cyan-600", border: "border-cyan-500" },
    amber: { grad: "from-amber-400 to-yellow-500", glow: "rgba(251,191,36,0.15)", text: "text-amber-600", border: "border-amber-500" },
    emerald: { grad: "from-emerald-400 to-emerald-600", glow: "rgba(16,185,129,0.15)", text: "text-emerald-600", border: "border-emerald-500" },
    rose: { grad: "from-rose-400 to-rose-600", glow: "rgba(244,63,94,0.15)", text: "text-rose-600", border: "border-rose-500" },
  };
  const a = accents[accent] ?? accents.blue;

  if (loading) return <SkeletonKpi />;

  return (
    <div
      className={`
        relative rounded-2xl p-6 min-h-[180px] overflow-hidden cursor-default
        transition-all duration-300 hover:-translate-y-2 hover:shadow-xl
        bg-white border-2 ${a.border} border-opacity-30
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
      `}
      style={{
        transitionDelay: `${delay}ms`,
        boxShadow: `0 4px 24px ${a.glow}`,
      }}
    >
      <div
        className="absolute -top-4 -right-4 w-24 h-24 rounded-full opacity-10"
        style={{ background: `radial-gradient(circle, ${a.glow.replace("0.15","0.6")}, transparent 70%)` }}
      />
      <div className="relative flex items-start justify-between">
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br ${a.grad} shadow-lg`}>
          <Icon size={24} className="text-white" />
        </div>
        <TrendingUp size={14} className={`mt-1 opacity-50 ${a.text}`} />
      </div>
      <p className="mt-5 text-4xl font-black tracking-tight text-gray-900 counter">
        {visible ? <Counter target={Number(value)} suffix={suffix} /> : "0"}
      </p>
      <p className="mt-2 text-xs font-bold uppercase tracking-widest text-gray-700">{label}</p>
      {sub && (
        <p className="mt-1 text-[10px] font-medium text-gray-700">
          {sub}
        </p>
      )}
    </div>
  );
}

function FeaturePill({ icon, text }) {
  return (
    <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 bg-white border-2 border-gray-200 shadow-sm hover:shadow-xl hover:border-indigo-300 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-indigo-50/60 to-transparent skew-x-12" />
      <span className="text-base relative z-10">{icon}</span>
      <span className="text-xs font-bold tracking-wide text-gray-800 relative z-10">{text}</span>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────
export default function Home() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyCount, setHistoryCount] = useState(0);
  const [topCandidate, setTopCandidate] = useState("—");
  const [candidatesProcessed, setCandidatesProcessed] = useState(0);
  const [avgScore, setAvgScore] = useState(0);
  const [prevScore, setPrevScore] = useState(0);
  const [scoreChange, setScoreChange] = useState(0)
  const [topScore, setTopScore] = useState(0);
  const [topResumeUrl, setTopResumeUrl] = useState("");
  const [topCandidateRankingId, setTopCandidateRankingId] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [scoreDistribution, setScoreDistribution] = useState([]);
  const [topSkill, setTopSkill] = useState("N/A");
  const [avgExperience, setAvgExperience] = useState(null);
  const [totalShortlisted, setTotalShortlisted] = useState(0);
  const [recentActivity, setRecentActivity] = useState([])

  const pathname = usePathname();
  const router = useRouter();

  // ─── Load Data ──────────────────────────────────────────────────
  // Applies a stats object (from cache or from a fresh fetch) to state.
  const applyStats = (stats) => {
    setHistoryCount(stats.history_count);
    setCandidatesProcessed(stats.candidates_processed);
    setScoreChange(stats.score_change);
    setTopCandidate(stats.top_candidate);
    setTopScore(stats.top_score);
    setTopCandidateRankingId(stats.top_candidate_ranking_id);
    setAvgScore(stats.avg_score);
    setPrevScore(stats.previous_avg_score);
    setTopSkill(stats.top_skill);
    setAvgExperience(stats.avg_experience);
    setTotalShortlisted(stats.total_shortlisted);
    setChartData(stats.chart_data);
    setScoreDistribution(stats.score_distribution);
    setRecentActivity(stats.recent_activity);
  };

  // loadStats(force):
  //   - force = false (default): serve from sessionStorage cache if it's
  //     still fresh (< 1 min old). This is what avoids re-hitting a
  //     cold-starting backend every time the user revisits the Dashboard.
  //   - force = true: always hit the network. Not currently called with
  //     true anywhere, but kept as an escape hatch (e.g. a manual
  //     "Refresh" button) since the cache is also cleared automatically
  //     right after a new ranking finishes (see new-rankings/page.js).
  const loadStats = useCallback(async (force = false) => {
    try {
      if (!force) {
        const cached = sessionStorage.getItem("dashboardStatsCache");
        const cachedAt = sessionStorage.getItem("dashboardStatsCacheTime");
        const isFresh = cachedAt && (Date.now() - Number(cachedAt) < DASHBOARD_CACHE_TTL_MS);

        if (cached && isFresh) {
          applyStats(JSON.parse(cached));
          setLoading(false);
          return;
        }
      }

      setLoading(true);

      const res = await fetch(`${API_BASE}/dashboard-stats`);
      const stats = await res.json();

      applyStats(stats);
      sessionStorage.setItem("dashboardStatsCache", JSON.stringify(stats));
      sessionStorage.setItem("dashboardStatsCacheTime", Date.now().toString());

      setLoading(false);
    } catch (error) {
      console.error("Dashboard load error:", error);
      setLoading(false);
    }
  }, []);

  // Initial load on mount — uses cache if fresh, otherwise fetches.
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Re-check whenever the user navigates back to the dashboard route.
  // This still respects the cache (see loadStats above), so it's cheap
  // unless the cache has genuinely expired or was cleared after a new
  // ranking completed — App Router can keep this page instance alive
  // across navigation, and without this the KPIs/gauge could otherwise
  // show stale data indefinitely.
  useEffect(() => {
    if (pathname === "/") {
      loadStats();
    }
  }, [pathname, loadStats]);

     // ─── Computed values ────────────────────────────────────────────
  const hoursSaved = useMemo(() => {
    const minsPerCandidate =12;
    return ((candidatesProcessed * minsPerCandidate) / 60).toFixed(1);
  }, [candidatesProcessed]);


  
  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 relative z-10 bg-gray-50">
        {/* Sticky Header */}
        <header className="sticky top-0 z-30 px-8 py-4 flex items-center justify-between bg-white shadow-sm border-b border-gray-200">
          <div>
            <p className="text-xs font-semibold tracking-wide text-gray-700">
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-bold tracking-wide text-green-600">System Online</span>
          </div>
        </header>

        <div className="flex-1 p-8 space-y-8 page-enter">
          {/* ── Hero Section ── */}
          <section
            className="relative rounded-3xl overflow-hidden py-14 px-10 bg-gradient-to-br from-blue-50/80 via-white to-violet-50/80 border-2 border-blue-100/50 shadow-lg"
          >
            <div
              className="absolute inset-0 opacity-5"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(59,130,246,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.1) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
            <div className="relative flex flex-col md:flex-row items-start md:items-center justify-around gap-8">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-4 bg-blue-100/50 border border-blue-200">
                  <Sparkles size={12} className="text-blue-700" />
                  <span className="text-sm font-extrabold tracking-wide text-blue-700">AI-Powered Recruitment</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-black leading-tight tracking-tight">
                  <span className="text-gray-900">Rank Smarter.</span>
                  <br />
                  <span className="bg-gradient-to-r from-sky-500 via-blue-500 to-violet-500 bg-clip-text text-transparent">Hire Faster.</span>
                </h1>
                <p className="mt-4 text-base font-medium max-w-md text-gray-700">
                  AI evaluates every candidate against your exact requirements — skills,
                  experience, and cultural fit — in seconds.
                </p>
                <Link href="/new-rankings">
                  <button
                    className="mt-6 inline-flex items-center gap-2 px-8 py-4 rounded-xl text-base font-extrabold tracking-wide text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/50 hover:scale-[1.02]"
                    style={{
                      background: "linear-gradient(135deg, #2563EB, #6D28D9)",
                    }}
                  >
                    <Sparkles size={15} />
                    Start Ranking Candidates
                    <ArrowRight size={14} />
                  </button>
                </Link>
              </div>

              {/* Stats ring visual */}
              {(() => {
                const size = 240;
                const strokeW = 18;
                const r = (size - strokeW) / 2;
                const circ = 2 * Math.PI * r;
                const pct = loading ? 0 : Math.min(Math.max(avgScore, 0), 100);
                const dash = (pct / 100) * circ;
                const prevPct = loading ? 0 : Math.min(Math.max(prevScore, 0), 100);
                return (
                  <div className="relative flex-shrink-0 transition-transform duration-500 hover:scale-105"
                    style={{ width: size, height: size }}>
                    {/* Glow layer */}
                    <div className="absolute inset-0 rounded-full"
                      style={{ boxShadow: "0 0 48px rgba(59,130,246,0.18), 0 0 96px rgba(124,58,237,0.10)" }} />
                    {/* SVG ring */}
                    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
                      {/* Track */}
                      <circle cx={size/2} cy={size/2} r={r}
                        fill="none" stroke="#e5e7eb" strokeWidth={strokeW} />
                      {/* Purple accent arc (top 16%) */}
                      <circle cx={size/2} cy={size/2} r={r}
                        fill="none" stroke="#7C3AED"
                        strokeWidth={strokeW}
                        strokeDasharray={`${(pct / 100) * 0.18 * circ} ${circ}`}
                        strokeDashoffset={-dash + (pct / 100) * 0.18 * circ}
                        strokeLinecap="round"
                        style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)" }} />
                      {/* Blue main arc */}
                      <circle cx={size/2} cy={size/2} r={r}
                        fill="none" stroke="url(#ringGrad)"
                        strokeWidth={strokeW}
                        strokeDasharray={`${dash} ${circ}`}
                        strokeLinecap="round"
                        style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)" }} />
                      <defs>
                        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#3B82F6" />
                          <stop offset="100%" stopColor="#7C3AED" />
                        </linearGradient>
                      </defs>
                    </svg>
                    {/* Inner white disc */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-44 h-44 rounded-full bg-white shadow-2xl flex flex-col items-center justify-center gap-0.5 border border-gray-100">
                        {loading ? (
                          <span className="text-2xl font-black text-gray-900 animate-pulse">…</span>
                        ) : (
                          <>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-black mb-1">Avg Match Score</span>
                            <div className="flex items-baseline gap-0.5">
                              <span className="text-[10px] font-semibold text-gray-600 mr-1">Now</span>
                              <span className="text-[28px] font-black leading-none tracking-tight text-gray-900">{avgScore}</span>
                              <span className="text-sm font-bold text-gray-700">%</span>
                            </div>
                            <div className="flex items-baseline gap-0.5 mt-0.5">
                              <span className="text-[10px] font-semibold text-gray-600 mr-1">Prev</span>
                              <span className="text-base font-bold tracking-tight text-gray-600">{prevPct}%</span>
                            </div>
                            <div className={`mt-2 flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold tracking-wide ${
                              scoreChange >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            }`}>
                              {scoreChange >= 0 ? "↑" : "↓"} {Math.abs(scoreChange)}% since last
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </section>

          {/* ── KPI Grid ── */}
          <section>
            <h2 className="text-sm font-extrabold tracking-widest mb-4 text-gray-700">OVERVIEW</h2>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-black font-bold">
              <KpiCard
                icon={BarChart3}
                label="Total Rankings"
                value={historyCount}
                accent="blue"
                delay={0}
                loading={loading}
              />
              <KpiCard
                icon={Users}
                label="Candidates Processed"
                value={candidatesProcessed}
                accent="violet"
                delay={80}
                loading={loading}
              />
              <KpiCard
                icon={TrendingUp}
                label="Avg Match Score"
                value={avgScore}
                suffix="%"
                accent="cyan"
                delay={160}
                loading={loading}
              />
              <div
                className="cursor-pointer hover:scale-105 transition-transform"
                onClick={() => {
                  if (topCandidateRankingId) {
                    router.push(`/results?from=${topCandidateRankingId}`);
                  } else if (topResumeUrl) {
                    window.open(topResumeUrl, "_blank");
                  }
                }}
              >
                <KpiCard
                  icon={Trophy}
                  label="Top Candidate"
                  value={topScore}
                  suffix="%"
                  accent="amber"
                  delay={240}
                  sub={topCandidate}
                  loading={loading}
                />
                {!loading && (topCandidateRankingId || topResumeUrl) && (
                  <p className="text-xs font-semibold text-blue-600 mt-1 text-center">
                    {topCandidateRankingId ? "Click card to view ranking" : "Click card to view resume"}
                  </p>
                )}
              </div>
              <KpiCard
                icon={Clock}
                label="Time Saved"
                value={hoursSaved}
                suffix="h"
                sub="AI Screening"
                accent="emerald"
                delay={400}
                loading={loading}
              />
            </div>
          </section>

          {/* ── Additional Metrics Row ── */}
          {!loading && (
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border-2 border-emerald-100 p-4 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <UserCheck className="text-emerald-600" size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-wide text-gray-700">Shortlisted</p>
                  <p className="text-xl font-black tracking-tight text-gray-900">{totalShortlisted}</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border-2 border-blue-100 p-4 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Brain className="text-blue-600" size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-wide text-gray-700">Top Skill</p>
                  <p className="text-xl font-black tracking-tight text-gray-900 truncate">{topSkill}</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border-2 border-purple-100 p-4 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Award className="text-purple-600" size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-wide text-gray-700">Avg Experience</p>
                  <p className="text-xl font-black tracking-tight text-gray-900">
                    {avgExperience !== null ? `${Number(avgExperience).toFixed(1)} yrs` : "—"}
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border-2 border-amber-100 p-4 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Target className="text-amber-600" size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-wide text-gray-700">Score Range</p>
                  <p className="text-xl font-black tracking-tight text-gray-900">
                    {historyCount > 0 ? "0–100" : "—"}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* ── Charts Row ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Rankings Over Time */}
            <section
              className="rounded-2xl p-6 bg-white border-2 border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300"
            >
              <h2 className="text-lg font-extrabold tracking-tight mb-4 text-gray-900">
                Rankings Created Over Time
              </h2>
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="ranking" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="candidates"
                      stroke="#3B82F6"
                      strokeWidth={3}
                      dot={{ fill: "#3B82F6", r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Score Distribution */}
            <section
              className="rounded-2xl p-6 bg-white border-2 border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300"
            >
              <h2 className="text-lg font-extrabold tracking-tight mb-4 text-gray-900">
                Candidate Score Distribution
              </h2>
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={scoreDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="range" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {scoreDistribution.map((entry, index) => {
                        const colorMap = {
                          "0-20":   "#EF4444", // red
                          "21-40":  "#F59E0B", // amber
                          "41-60":  "#3B82F6", // blue
                          "61-80":  "#10B981", // emerald
                          "81-100": "#7C3AED", // violet
                        };
                        return <Cell key={`cell-${index}`} fill={colorMap[entry.range] ?? "#8B5CF6"} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          {/* ── Recent Activity ── */}
          <section className="mt-6">
            <div
              className="rounded-2xl p-6 shadow-sm bg-white border-2 border-gray-200 hover:shadow-lg transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-extrabold tracking-tight text-gray-900">Recent Activity</h2>
                <span className="text-xs font-extrabold tracking-wide text-green-600">Live Updates</span>
              </div>
              <div className="space-y-3">
                {recentActivity.length > 0 ? (
                  recentActivity.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 border-b border-gray-100 pb-2 last:border-0 hover:bg-gray-50 p-2 rounded-xl transition-all duration-200">
                      <span className="text-sm">📄</span>
                      <div className="flex-1">
                        <p className="text-sm font-bold tracking-tight text-gray-800">{item.job_domain}</p>
                        <p className="text-xs font-medium text-gray-700">
                          {item.candidate_count} candidates · {item.created_at ? new Date(item.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                        </p>
                      </div>
                      <Link href={`/results?from=${item.id}`}>
                        <button className="text-xs font-extrabold tracking-wide text-blue-600 hover:underline">View</button>
                      </Link>
                    </div>
                  ))
                ) : (
                  <p className="text-sm font-medium text-gray-700">No recent activity</p>
                )}
              </div>
            </div>
          </section>

          {/* ── Quick Actions ── */}
          <section className="mt-10">
            <h2 className="text-lg font-extrabold tracking-tight text-gray-900 mb-6">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: Sparkles,
                  color: "from-blue-500 to-violet-600",
                  title: "New Ranking",
                  desc: "Upload resumes and start a new AI screening process.",
                  href: "/new-rankings",
                  cta: "Start Screening",
                },
                {
                  icon: BarChart3,
                  color: "from-cyan-500 to-blue-600",
                  title: "Latest Results",
                  desc: "View candidate rankings and detailed AI evaluations.",
                  href: "/results",
                  cta: "View Results",
                },
                {
                  icon: Clock,
                  color: "from-emerald-500 to-teal-600",
                  title: "History",
                  desc: "Browse previous rankings, reports and sessions.",
                  href: "/history",
                  cta: "Open History",
                },
              ].map(({ icon: Icon, color, title, desc, href, cta }) => (
                <Link key={href} href={href} className="block">
                  <div
                    className="bg-white rounded-3xl p-6 border-2 border-gray-200 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 h-full hover:border-indigo-300"
                  >
                    <div
                      className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${color}
                        flex items-center justify-center mb-5 shadow-lg`}
                    >
                      <Icon size={24} className="text-white" />
                    </div>
                    <h3 className="text-lg font-extrabold tracking-tight text-gray-900">{title}</h3>
                    <p className="text-gray-700 text-sm font-medium mt-2">{desc}</p>
                    <div className="mt-5 text-blue-600 font-extrabold tracking-wide flex items-center gap-2">
                      {cta}
                      <ArrowRight size={16} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* ── Trust Footer ── */}
          <section
            className="rounded-2xl p-6 bg-white border-2 border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300"
          >
            <p className="text-xs font-extrabold tracking-widest mb-4 text-gray-700">WHY FORGEMATCH</p>
            <div className="flex flex-wrap gap-3">
              {[
                { icon: "🧠", text: "AI-Powered Evaluation" },
                { icon: "⚖️", text: "Multi-Factor Ranking" },
                { icon: "🎯", text: "Bias Reduction" },
                { icon: "⚡", text: "Fast Candidate Screening" },
                { icon: "🔒", text: "Secure & Private" },
                { icon: "📊", text: "Detailed Analytics" },
              ].map((f) => (
                <FeaturePill key={f.text} icon={f.icon} text={f.text} />
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}