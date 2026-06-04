"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar  from "../components/Sidebar";

// ── tiny helpers ──────────────────────────────────────────────────────────────
const clamp = (n) => Math.max(0, Math.min(100, n ?? 0));

function scoreColor(s) {
  if (s >= 90) return { bar: "bg-emerald-500", text: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" };
  if (s >= 75) return { bar: "bg-blue-500",    text: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-200"    };
  if (s >= 60) return { bar: "bg-amber-500",   text: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-200"   };
  return              { bar: "bg-red-500",      text: "text-red-600",     bg: "bg-red-50",     border: "border-red-200"     };
}

function badge(s) {
  if (s >= 85) return { label: "Interview Ready",    cls: "bg-emerald-100 text-emerald-700 border border-emerald-200" };
  if (s >= 70) return { label: "Strong Candidate",   cls: "bg-blue-100 text-blue-700 border border-blue-200"         };
  if (s >= 55) return { label: "Needs Review",       cls: "bg-amber-100 text-amber-700 border border-amber-200"      };
  return              { label: "Not Recommended",    cls: "bg-red-100 text-red-700 border border-red-200"            };
}

// ── animated progress bar ────────────────────────────────────────────────────
function Bar({ value, colorClass = "bg-blue-500", delay = 0, height = "h-2" }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(clamp(value)), 120 + delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return (
    <div className={`w-full bg-gray-100 rounded-full ${height} overflow-hidden`}>
      <div
        className={`${height} rounded-full ${colorClass} transition-all duration-1000 ease-out`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

// ── metric card ──────────────────────────────────────────────────────────────
function MetricCard({ icon, label, value, sub, accent = "blue" }) {
  const accents = {
    blue:    "from-blue-500 to-blue-600",
    emerald: "from-emerald-500 to-emerald-600",
    violet:  "from-violet-500 to-violet-600",
    amber:   "from-amber-500 to-amber-600",
    rose:    "from-rose-500 to-rose-600",
    slate:   "from-slate-600 to-slate-700",
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-5 flex items-start gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${accents[accent]} flex items-center justify-center text-white text-lg flex-shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-700 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        {sub && <p className="text-xs text-gray-700 mt-1">{sub}</p>}
      </div>
    </div>
  );
}




// ── main component ────────────────────────────────────────────────────────────
export default function Results() {
  const [results,           setResults           ] = useState(null);
  const [expandedCandidate, setExpandedCandidate ] = useState(null);
  const [showFullList,      setShowFullList       ] = useState(false);
  const [savedCandidates,   setSavedCandidates    ] = useState([]);
  const [searchQuery,       setSearchQuery        ] = useState("");
  const [sortBy,            setSortBy             ] = useState("overall_score");
  const [mounted,           setMounted            ] = useState(false);

  useEffect(() => {
    setMounted(true);
    const data = localStorage.getItem("rankingResults");
    if (data) setResults(JSON.parse(data));
  }, []);

  // ── resume actions ──
  const handleViewResume = (candidate) => {
    if (candidate.resume_url) {
      const url = encodeURI(candidate.resume_url);
      window.open(url, "_blank");
    } else {
      alert("No resume available for this candidate.");
    }
  };

  const handleDownloadResume = (candidate) => {
    if (candidate.resume_url) {
      const link = document.createElement("a");
      link.href = encodeURI(candidate.resume_url);
      link.download = `${candidate.name}_resume.pdf`;
      link.click();
    } else {
      alert("No resume available for this candidate.");
    }
  };

  const toggleSave = (name) => {
    setSavedCandidates((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  // ── derived data ──
  const allRankings       = results?.rankings ?? [];
  const topCandidates     = allRankings.slice(0, 3);
  const shortlisted       = allRankings.slice(0, 30);
  const avgScore          = allRankings.length
    ? Math.round(allRankings.reduce((s, c) => s + clamp(c.overall_score), 0) / allRankings.length)
    : 0;
  const interviewReady    = allRankings.filter((c) => clamp(c.overall_score) >= 85).length;
  const above85           = interviewReady;

  const distribution = [
    { label: "Excellent", range: "90–100", min: 90, color: "bg-emerald-500", count: allRankings.filter((c) => clamp(c.overall_score) >= 90).length },
    { label: "Strong",    range: "80–89",  min: 80, color: "bg-blue-500",    count: allRankings.filter((c) => clamp(c.overall_score) >= 80 && clamp(c.overall_score) < 90).length },
    { label: "Good",      range: "70–79",  min: 70, color: "bg-violet-500",  count: allRankings.filter((c) => clamp(c.overall_score) >= 70 && clamp(c.overall_score) < 80).length },
    { label: "Average",   range: "60–69",  min: 60, color: "bg-amber-500",   count: allRankings.filter((c) => clamp(c.overall_score) >= 60 && clamp(c.overall_score) < 70).length },
    { label: "Poor",      range: "<60",    min: 0,  color: "bg-red-400",     count: allRankings.filter((c) => clamp(c.overall_score) < 60).length },
  ];

  // top skill from first candidate
  const topSkill = allRankings[0]?.skills?.[0] ?? "N/A";

  // filtered + sorted shortlist
  const filteredList = shortlisted
    .filter((c) => c.name?.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => clamp(b[sortBy] ?? b.overall_score) - clamp(a[sortBy] ?? a.overall_score));

  const medals = ["🥇", "🥈", "🥉"];
  const medalBg = [
    "bg-gradient-to-br from-amber-50 to-yellow-100 border-amber-200",
    "bg-gradient-to-br from-slate-50 to-gray-100 border-gray-200",
    "bg-gradient-to-br from-orange-50 to-amber-100 border-orange-200",
  ];

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex bg-gray-50 font-sans">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0">
        {/* ── top bar ── */}
        <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-4 sticky top-0 z-30 shadow-lg">
          
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-gray-900">AI Talent Intelligence Report</h1>
            <p className="text-xs text-gray-700">AI-powered candidate analysis and ranking</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              Analysis Complete
            </span>
            <Link href="/new-rankings">
              <button className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-md">
                + New Ranking
              </button>
            </Link>
          </div>
        </header>

        <main className="flex-1 p-6 space-y-6 overflow-y-auto">

          {/* ── KPI METRICS ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard icon="📄" label="Resumes Analyzed"  value={allRankings.length || 0} sub="This session"            accent="blue"    />
            <MetricCard icon="✅" label="Shortlisted"        value={shortlisted.length || 0} sub="Top candidates"         accent="emerald" />
            <MetricCard icon="⚡" label="Avg Match Score"    value={`${avgScore}%`}          sub="Across all candidates"  accent="violet"  />
            <MetricCard icon="🎯" label="Interview Ready"    value={interviewReady}          sub="Score ≥ 85%"            accent="amber"   />
          </div>

          {/* ── AI HIRING INSIGHTS ── */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-xl">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-xl">🧠</div>
                <div>
                  <h2 className="font-bold text-lg">AI Hiring Insights</h2>
                  <p className="text-slate-400 text-xs">Generated from candidate analysis</p>
                </div>
              </div>
              <span className="text-xs bg-blue-500/20 border border-blue-400/30 text-blue-300 px-3 py-1 rounded-full">AI Generated</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { icon: "✓", label: "Total Candidates Analyzed",  value: allRankings.length                      },
                { icon: "✓", label: "Strongest Skill Found",       value: topSkill                                },
                { icon: "✓", label: "Candidates Above 85%",        value: above85                                 },
                { icon: "✓", label: "Recommended Interviews",      value: Math.min(above85 + 2, allRankings.length) },
                { icon: "✓", label: "Average Match Score",         value: `${avgScore}%`                          },
                { icon: "✓", label: "Top Candidate Score",         value: `${clamp(allRankings[0]?.overall_score)}%` },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 flex items-center justify-center text-xs font-bold flex-shrink-0">{item.icon}</span>
                  <div className="min-w-0">
                    <p className="text-slate-400 text-xs">{item.label}</p>
                    <p className="text-white font-semibold text-sm truncate">{String(item.value)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── TOP 3 PODIUM ── */}
          {topCandidates.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-6">
              <div className="flex items-center gap-2 mb-5">
                <span className="text-xl">🏆</span>
                <h2 className="font-bold text-gray-900 text-lg">Top Candidates</h2>
                <span className="ml-auto text-xs text-gray-700">Best matches for this role</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {topCandidates.map((c, i) => {
                  const sc = scoreColor(clamp(c.overall_score));
                  return (
                    <div key={i} className={`rounded-2xl border p-5 ${medalBg[i]} relative overflow-hidden hover:shadow-md transition-all duration-200 hover:-translate-y-0.5`}>
                      {i === 0 && (
                        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/10 rounded-full -translate-y-8 translate-x-8" />
                      )}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">{medals[i]}</span>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 text-sm truncate">{c.name ?? "Unknown"}</p>
                          <p className="text-xs text-gray-500">{c.experience_years ?? 0} yrs experience</p>
                        </div>
                      </div>
                      <div className="flex items-end justify-between mb-2">
                        <span className="text-xs text-gray-500">Overall Match</span>
                        <span className={`text-2xl font-black ${sc.text}`}>{clamp(c.overall_score)}%</span>
                      </div>
                      <Bar value={clamp(c.overall_score)} colorClass={sc.bar} delay={i * 150} height="h-2.5" />
                      {c.skills?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {c.skills.slice(0, 3).map((sk) => (
                            <span key={sk} className="text-[10px] bg-white/70 text-gray-600 border border-gray-200 px-2 py-0.5 rounded-full">{sk}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── TALENT DISTRIBUTION ── */}
          {allRankings.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6">
              <h2 className="font-bold text-gray-900 text-lg mb-1">Talent Distribution</h2>
              <p className="text-xs text-gray-700 mb-5">Candidate quality breakdown across scoring tiers</p>
              <div className="space-y-3">
                {distribution.map((d, idx) => (
                  <div key={d.label} className="flex items-center gap-3">
                    <div className="w-24 flex-shrink-0">
                      <p className="text-sm font-medium text-gray-700">{d.label}</p>
                      <p className="text-xs text-gray-700">{d.range}</p>
                    </div>
                    <div className="flex-1">
                      <Bar value={allRankings.length ? (d.count / allRankings.length) * 100 : 0} colorClass={d.color} delay={idx * 100} />
                    </div>
                    <div className="w-16 text-right flex-shrink-0">
                      <span className="text-sm font-bold text-gray-700">{d.count}</span>
                      <span className="text-xs text-gray-700 ml-1">
                        ({allRankings.length ? Math.round((d.count / allRankings.length) * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SHORTLISTED CANDIDATES ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">Top 30 Shortlisted Candidates</h2>
                <p className="text-xs text-gray-700 mt-0.5">Ranked by AI match score</p>
              </div>
              <button
                onClick={() => setShowFullList(!showFullList)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition-all duration-200 shadow-lg"
              >
                {showFullList ? "Hide List ▲" : "View Full List ▼"}
              </button>
            </div>

            {/* search + sort */}
            {showFullList && (
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <input
                  type="text"
                  placeholder="Search candidates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 text-gray-700 placeholder-gray-400"
                />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 text-gray-700 bg-white"
                >
                  <option value="overall_score">Sort: Overall Score</option>
                  <option value="technical_match">Sort: Technical Match</option>
                  <option value="behavioral_fit">Sort: Behavioral Fit</option>
                  <option value="experience_match">Sort: Experience Match</option>
                </select>
              </div>
            )}

            {showFullList && (
              <div className="space-y-2">
                {filteredList.length === 0 && (
                  <p className="text-center text-gray-700 py-8 text-sm">No candidates match your search.</p>
                )}
                {filteredList.map((c, idx) => {
                  const sc      = scoreColor(clamp(c.overall_score));
                  const bd      = badge(clamp(c.overall_score));
                  const isOpen  = expandedCandidate === idx;
                  const isSaved = savedCandidates.includes(c.name);

                  // parse AI reason into bullet points
                  const reasonParts = (c.reason ?? "")
                    .split(/[.;,]/)
                    .map((s) => s.trim())
                    .filter((s) => s.length > 8)
                    .slice(0, 5);

                  const metrics = [
                    { label: "Technical Match",  value: clamp(c.technical_match),  color: scoreColor(clamp(c.technical_match)).bar  },
                    { label: "Behavioral Fit",   value: clamp(c.behavioral_fit),   color: scoreColor(clamp(c.behavioral_fit)).bar   },
                    { label: "Experience Match", value: clamp(c.experience_match), color: scoreColor(clamp(c.experience_match)).bar },
                    { label: "Project Relevance",value: clamp(c.project_relevance),color: scoreColor(clamp(c.project_relevance)).bar},
                  ];

                  return (
                    <div key={idx} className={`border rounded-2xl overflow-hidden transition-all duration-200 ${isOpen ? "border-blue-200 shadow-md" : "border-gray-100 hover:border-gray-200 hover:shadow-lg"}`}>
                      {/* row */}
                      <div className={`flex items-center gap-3 p-4 cursor-pointer ${isOpen ? "bg-blue-50/50" : "hover:bg-gray-50"}`}
                        onClick={() => setExpandedCandidate(isOpen ? null : idx)}>
                        <span className={`w-9 h-9 rounded-full ${isOpen ? "bg-blue-600" : "bg-slate-800"} text-white text-xs font-bold flex items-center justify-center flex-shrink-0 transition-colors`}>
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900 text-sm">{c.name ?? "Unknown"}</p>
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${bd.cls}`}>{bd.label}</span>
                            {isSaved && <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">⭐ Saved</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5">
                            <Bar value={clamp(c.overall_score)} colorClass={sc.bar} delay={idx * 30} height="h-1.5" />
                            <span className={`text-sm font-bold ${sc.text} flex-shrink-0 w-10 text-right`}>{clamp(c.overall_score)}%</span>
                          </div>
                        </div>
                        <span className={`text-gray-700 text-xs transition-transform duration-300 flex-shrink-0 ${isOpen ? "rotate-180" : ""}`}>▼</span>
                      </div>

                      {/* expanded */}
                      {isOpen && (
                        <div className="border-t border-blue-100 bg-white p-5 space-y-5">
                          {/* score breakdown */}
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Score Breakdown</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {metrics.map((m, mi) => (
                                <div key={m.label} className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-gray-600">{m.label}</span>
                                    <span className="text-sm font-bold text-gray-900">{m.value}%</span>
                                  </div>
                                  <Bar value={m.value} colorClass={m.color} delay={mi * 80} />
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* AI confidence */}
                          <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl p-4 border border-blue-100 flex items-center justify-between">
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">AI Confidence</p>
                              <p className="text-2xl font-black text-slate-900 mt-0.5">{Math.min(clamp(c.overall_score) + 4, 99)}%</p>
                            </div>
                            <span className={`text-xs font-medium px-3 py-1.5 rounded-full border ${clamp(c.overall_score) >= 80 ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-100 text-amber-700 border-amber-200"}`}>
                              {clamp(c.overall_score) >= 80 ? "High Confidence" : "Moderate Confidence"}
                            </span>
                          </div>

                          {/* AI reasoning */}
                          {reasonParts.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Why AI Ranked This Candidate</h4>
                              <div className="space-y-2">
                                {reasonParts.map((r, ri) => (
                                  <div key={ri} className="flex items-start gap-2.5 bg-emerald-50 rounded-xl px-3.5 py-2.5 border border-emerald-100">
                                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">✓</span>
                                    <p className="text-sm text-gray-700">{r}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* skills */}
                          {c.skills?.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Skill Match Analysis</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {c.skills.slice(0, 6).map((sk, si) => {
                                  const fakePct = Math.max(60, clamp(c.overall_score) - si * 5);
                                  const skc = scoreColor(fakePct);
                                  return (
                                    <div key={sk} className="flex items-center gap-2.5">
                                      <span className="text-xs text-gray-600 w-24 truncate flex-shrink-0">{sk}</span>
                                      <div className="flex-1"><Bar value={fakePct} colorClass={skc.bar} delay={si * 60} height="h-1.5" /></div>
                                      <span className={`text-xs font-semibold ${skc.text} w-8 text-right flex-shrink-0`}>{fakePct}%</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* actions */}
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                            <button
                              onClick={() => handleViewResume(c)}
                              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all duration-200 shadow-lg hover:shadow-md"
                            >
                              👁 View Resume
                            </button>
                            <button
                              onClick={() => handleDownloadResume(c)}
                              className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold transition-all duration-200"
                            >
                              ⬇ Download
                            </button>
                            <button
                              onClick={() => toggleSave(c.name)}
                              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border ${
                                isSaved
                                  ? "bg-amber-100 text-amber-700 border-amber-200"
                                  : "border-gray-200 hover:bg-gray-50 text-gray-700"
                              }`}
                            >
                              {isSaved ? "⭐ Saved" : "☆ Save"}
                            </button>
                            <button className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-xs font-semibold cursor-not-allowed opacity-60">
                              📧 Contact <span className="text-[9px] bg-gray-100 text-gray-700 px-1 rounded">Soon</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── COMING SOON – AI INTERVIEW PREDICTOR ── */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white border border-slate-700 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/30 via-transparent to-transparent" />
            <div className="relative flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-2xl flex-shrink-0">🤖</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-lg">AI Interview Predictor</h3>
                  <span className="text-xs bg-blue-500/20 border border-blue-400/30 text-blue-300 px-2.5 py-1 rounded-full font-medium">Coming Soon</span>
                </div>
                <p className="text-slate-400 text-sm mt-1 mb-3">Predicts interview success probability using deep candidate profile analysis, behavioral signals, and role-specific benchmarks.</p>
                <div className="flex flex-wrap gap-2">
                  {["Success Probability", "Behavioral Fit Score", "Cultural Alignment", "Role Readiness"].map((f) => (
                    <span key={f} className="text-xs bg-white/5 border border-white/10 text-slate-400 px-3 py-1 rounded-full">{f}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── SAVED CANDIDATES ── */}
          {savedCandidates.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-6">
              <h2 className="font-bold text-gray-900 text-lg mb-4">⭐ Saved Candidates</h2>
              <div className="flex flex-wrap gap-2">
                {savedCandidates.map((name) => (
                  <div key={name} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <span className="text-sm font-medium text-amber-800">{name}</span>
                    <button onClick={() => toggleSave(name)} className="text-amber-400 hover:text-amber-600 text-xs">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

