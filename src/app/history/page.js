"use client";
 import Sidebar from "../components/Sidebar";
 import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  History as HistoryIcon, Search, Calendar, Users, Trophy,
  TrendingUp, ArrowRight, Clock, Sparkles, Filter, SortAsc,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

/* ── Skeleton loader ───────────────────────────────────────────── */
function HistorySkeleton() {
  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}>
      <div className="flex items-start gap-4">
        <div className="skeleton w-10 h-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-2/3 rounded-lg" />
          <div className="skeleton h-3 w-1/2 rounded-lg" />
        </div>
        <div className="skeleton h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}

/* ── History card ──────────────────────────────────────────────── */
function HistoryCard({ item, onOpen }) {
  const date = new Date(item.created_at).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
  const time = new Date(item.created_at).toLocaleTimeString("en-IN", {
    hour: "numeric", minute: "2-digit",
  });

  const avgScore = item.avg_score
    ? Math.round(item.avg_score)
    : null;

  return (
    <div
      className="rounded-2xl p-5 card-hover cursor-pointer group"
      style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      onClick={() => onOpen(item.id)}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(124,58,237,0.15))",
            border: "1px solid rgba(59,130,246,0.15)",
          }}
        >
          <Sparkles size={16} className="text-blue-400" />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-black group-hover:text-blue-300 transition-colors truncate">
            {item.job_domain ?? "Untitled Ranking"}
          </h3>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap text-green-600">
            <div className="flex items-center gap-1">
              <Calendar size={10}  />
              <span className="text-[10px]" >{date}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock size={10} />
              <span className="text-[10px]" >{time}</span>
            </div>
            {item.candidate_count != null && (
              <div className="flex items-center gap-1">
                <Users size={10}  />
                <span className="text-[10px]" >
                  {item.candidate_count} candidates
                </span>
              </div>
            )}
          </div>

          {/* Tags row */}
          <div className="flex gap-2 mt-2.5 flex-wrap">
            {item.top_candidate && (
              <span
                className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-lg"
                style={{
                  background: "rgba(245,158,11,0.1)",
                  border: "1px solid rgba(245,158,11,0.2)",
                  color: "#FCD34D",
                }}
              >
                <Trophy size={9} />
                {item.top_candidate}
              </span>
            )}
            {avgScore != null && (
              <span
                className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-lg"
                style={{
                  background: "rgba(59,130,246,0.1)",
                  border: "1px solid rgba(59,130,246,0.2)",
                  color: "#60A5FA",
                }}
              >
                <TrendingUp size={9} />
                Avg {avgScore}%
              </span>
            )}
          </div>
        </div>

        {/* CTA */}
        <button
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 opacity-0 group-hover:opacity-100 flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, #3B82F6, #7C3AED)",
            color: "white",
          }}
        >
          View <ArrowRight size={11} />
        </button>
      </div>
    </div>
  );
}


   export default function History() {
  
    const [items,    setItems   ] = useState([]);
  const [loading,  setLoading ] = useState(true);
  const [search,   setSearch  ] = useState("");
  const [sort,     setSort    ] = useState("newest");
  const router = useRouter();

useEffect(() => {
    const cached = sessionStorage.getItem("historyCache");
    const cachedAt = sessionStorage.getItem("historyCacheTime");
    const isFresh = cachedAt && (Date.now() - Number(cachedAt) < 60000); // 1 min

    if (cached && isFresh) {
      setItems(JSON.parse(cached));
      setLoading(false);
      return;
    }

    fetch(`${API_BASE}/rankings`)
      .then((r) => r.json())
      .then((d) => {
        setItems(d ?? []);
        sessionStorage.setItem("historyCache", JSON.stringify(d ?? []));
        sessionStorage.setItem("historyCacheTime", Date.now().toString());
        setLoading(false);
      })
      .catch(() => {
        setItems([
          { id: "demo-1", job_domain: "ML Engineer", created_at: new Date(Date.now() - 86400000).toISOString(), candidate_count: 12, top_candidate: "Anjali R." },
          { id: "demo-2", job_domain: "Frontend Developer", created_at: new Date(Date.now() - 2*86400000).toISOString(), candidate_count: 8, top_candidate: "Rahul S." },
          { id: "demo-3", job_domain: "Data Scientist", created_at: new Date(Date.now() - 3*86400000).toISOString(), candidate_count: 15, top_candidate: "Monisha K." },
        ]);
        setLoading(false);
      });
  }, []);

  const openRanking = async (id) => {
    if (id.startsWith("demo")) return;
    try {
      const r = await fetch(`${API_BASE}/rankings/${id}`);
      const data = await r.json();
      localStorage.setItem("rankingResults", JSON.stringify(data));
      router.push("/results");
    } catch {
      alert("Could not load this ranking.");
    }
  };

  const filtered = items
    .filter((i) => (i.job_domain ?? "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === "newest")     return new Date(b.created_at) - new Date(a.created_at);
      if (sort === "oldest")     return new Date(a.created_at) - new Date(b.created_at);
      if (sort === "candidates") return (b.candidate_count ?? 0) - (a.candidate_count ?? 0);
      return 0;
    });
   

    return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-base)" }}>
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 relative z-10 bg-white">
        {/* Topbar */}
        <header
          className="sticky top-0 z-30 px-8 py-4 flex items-center gap-3 bg-white shadow-lg"
          
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-black"
            style={{ background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.25)" }}
          >
            <HistoryIcon size={14} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-black">Ranking History</h1>
            <p className="text-[12px] text-emerald-600">
              {items.length} total session{items.length !== 1 ? "s" : ""}
            </p>
          </div>
        </header>

        <div className="flex-1 p-8 page-enter">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6 border ">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-800"  />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by job domain..."
                className="w-full pl-8 pr-4 py-2.5 rounded-xl text-sm text-black placeholder-slate-600 outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
              />
            </div>
            <div className="relative">
              <SortAsc size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-900"/>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="pl-8 pr-8 py-2.5 rounded-xl text-sm text-slate-600 outline-none appearance-none cursor-pointer"
               
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="candidates">Most candidates</option>
              </select>
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <HistorySkeleton key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <div
                className="w-16 h-16 rounded-3xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)" }}
              >
                <HistoryIcon size={28} className="text-blue-400" />
              </div>
              <h3 className="text-base font-bold text-black mb-2">No rankings found</h3>
              <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
                {search ? `No results matching "${search}"` : "Run your first ranking to see it here."}
              </p>
              {!search && (
                <Link href="/new-rankings">
                  <button
                    className="px-6 py-3 rounded-xl text-sm font-semibold text-black"
                    style={{ background: "linear-gradient(135deg, #3B82F6, #7C3AED)" }}
                  >
                    Start Ranking
                  </button>
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((item) => (
                <HistoryCard key={item.id} item={item} onOpen={openRanking} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
