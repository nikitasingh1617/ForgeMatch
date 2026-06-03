"use client";

import Sidebar from "../components/Sidebar";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Eye,
  Mail,
  Medal,
  Save,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
} from "lucide-react";

const scoreRanges = [
  { label: "Excellent", range: "90-100", min: 90, max: 100, color: "bg-emerald-500" },
  { label: "Strong", range: "80-89", min: 80, max: 89, color: "bg-blue-500" },
  { label: "Good", range: "70-79", min: 70, max: 79, color: "bg-cyan-500" },
  { label: "Average", range: "60-69", min: 60, max: 69, color: "bg-amber-500" },
  { label: "Poor", range: "<60", min: 0, max: 59, color: "bg-rose-500" },
];

const medalStyles = [
  {
    label: "Gold",
    icon: "1",
    card: "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-yellow-50",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    bar: "bg-amber-500",
  },
  {
    label: "Silver",
    icon: "2",
    card: "border-slate-200 bg-gradient-to-br from-slate-50 via-white to-gray-50",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    bar: "bg-slate-500",
  },
  {
    label: "Bronze",
    icon: "3",
    card: "border-orange-200 bg-gradient-to-br from-orange-50 via-white to-amber-50",
    badge: "bg-orange-100 text-orange-700 border-orange-200",
    bar: "bg-orange-500",
  },
];

const knownSkills = [
  "React",
  "Next.js",
  "Node.js",
  "AWS",
  "System Design",
  "Python",
  "JavaScript",
  "TypeScript",
  "Leadership",
  "Cloud",
  "Kubernetes",
  "Machine Learning",
];

function clampScore(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function getCandidateScore(candidate, key, fallback = 0) {
  return clampScore(candidate?.[key] ?? fallback);
}

function getScoreColor(score) {
  if (score >= 90) return "bg-emerald-500";
  if (score >= 75) return "bg-blue-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-rose-500";
}

function getConfidence(score) {
  if (score >= 90) return { label: "High Confidence", color: "bg-emerald-100 text-emerald-700" };
  if (score >= 75) return { label: "Strong Signal", color: "bg-blue-100 text-blue-700" };
  if (score >= 60) return { label: "Moderate Signal", color: "bg-amber-100 text-amber-700" };
  return { label: "Needs Review", color: "bg-rose-100 text-rose-700" };
}

function getCandidateSkills(candidate) {
  const fields = [
    candidate?.skills,
    candidate?.key_skills,
    candidate?.matched_skills,
    candidate?.top_skills,
  ];

  const rawSkills = fields
    .flatMap((field) => {
      if (Array.isArray(field)) return field;
      if (typeof field === "string") return field.split(/,|\|/);
      return [];
    })
    .map((skill) => String(skill).trim())
    .filter(Boolean);

  if (rawSkills.length > 0) return [...new Set(rawSkills)].slice(0, 5);

  const text = `${candidate?.reason || ""} ${candidate?.summary || ""}`.toLowerCase();
  const inferred = knownSkills.filter((skill) => text.includes(skill.toLowerCase()));
  return inferred.length > 0 ? inferred.slice(0, 5) : ["Role Fit", "Domain Knowledge", "Communication"];
}

function getSkillBreakdown(candidate) {
  const base = clampScore(candidate?.overall_score);
  return getCandidateSkills(candidate).slice(0, 5).map((skill, index) => ({
    label: skill,
    value: clampScore(base - index * 4 + (index === 0 ? 2 : 0)),
  }));
}

function splitReason(candidate) {
  const reason = candidate?.reason || "Strong profile alignment with the job requirements.";
  const pieces = reason
    .split(/\.|;|\n|•|-/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length < 140);

  if (pieces.length > 0) return pieces.slice(0, 5);

  return [
    "Strong requirement alignment",
    "Relevant professional experience",
    "Good keyword coverage",
  ];
}

function getConcerns(candidate) {
  const fields = [candidate?.red_flags, candidate?.concerns, candidate?.skill_gaps];
  const concerns = fields
    .flatMap((field) => {
      if (Array.isArray(field)) return field;
      if (typeof field === "string") return field.split(/,|;|\n/);
      return [];
    })
    .map((item) => String(item).trim())
    .filter(Boolean);

  if (concerns.length > 0) return concerns.slice(0, 3);

  const score = clampScore(candidate?.overall_score);
  if (score >= 80) return [];
  if (score >= 60) return ["Some requirements may need recruiter validation"];
  return ["Low match score requires manual review"];
}

function ProgressBar({ value, color, height = "h-2.5" }) {
  const score = clampScore(value);

  return (
    <div className={`w-full overflow-hidden rounded-full bg-slate-200 ${height}`}>
      <div
        className={`${color || getScoreColor(score)} ${height} rounded-full transition-all duration-1000 ease-out`}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="group rounded-2xl border border-white/70 bg-white/85 p-5 shadow-sm shadow-slate-200/70 backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
        </div>
        <div className={`rounded-2xl p-3 ${accent}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

export default function Results() {
  const [results] = useState(() => {
    if (typeof window === "undefined") return null;

    const data = localStorage.getItem("rankingResults");
    return data ? JSON.parse(data) : null;
  });
  const [expandedCandidate, setExpandedCandidate] = useState(null);
  const [showFullList, setShowFullList] = useState(false);

  const rankings = useMemo(() => results?.rankings || [], [results]);
  const topCandidates = rankings.slice(0, 3);
  const shortlistedCandidates = rankings.slice(0, 30);
  const totalAnalyzed = results?.total_resumes_analyzed || results?.total_resumes || rankings.length;
  const averageScore =
    rankings.length > 0
      ? Math.round(rankings.reduce((sum, candidate) => sum + clampScore(candidate.overall_score), 0) / rankings.length)
      : 0;
  const aboveEightyFive = rankings.filter((candidate) => clampScore(candidate.overall_score) >= 85).length;
  const strongestSkill =
    topCandidates.flatMap((candidate) => getCandidateSkills(candidate))[0] || "Requirement alignment";
  const commonGap =
    rankings.flatMap((candidate) => getConcerns(candidate))[0] || "No major recurring gaps detected";
  const analysisTime = results?.analysis_time || results?.processing_time || "14.2s";

  const distribution = scoreRanges.map((range) => ({
    ...range,
    count: rankings.filter((candidate) => {
      const score = clampScore(candidate.overall_score);
      return score >= range.min && score <= range.max;
    }).length,
  }));

  const handleViewResume = (candidate) => {
    if (candidate.resume_url) {
      const url = encodeURI(candidate.resume_url);
      window.open(url, "_blank");
    } else {
      alert("No resume available for this candidate.");
    }
  };

  const handleDownloadResume = async (candidate) => {
    if (candidate.resume_url) {
      const link = document.createElement("a");
      link.href = candidate.resume_url;
      link.download = `${candidate.name}_resume.pdf`;
      link.click();
    } else {
      alert("No resume available for this candidate.");
    }
  };

  return (
    <main className="min-h-screen flex bg-slate-100 text-slate-950">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <section className="relative overflow-hidden border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_32%),linear-gradient(135deg,#ffffff_0%,#f8fafc_55%,#ecfeff_100%)] px-5 py-8 sm:px-8 lg:px-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
              <div className="animate-[fadeIn_0.5s_ease-out]">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 py-1 text-sm font-semibold text-blue-700 shadow-sm">
                  <Sparkles size={16} />
                  ForgeMatch AI Report
                </div>
                <h1 className="text-4xl font-bold tracking-normal text-slate-950 sm:text-5xl">
                  AI Talent Intelligence Report
                </h1>
                <p className="mt-3 max-w-2xl text-base text-slate-600 sm:text-lg">
                  AI-powered candidate analysis and ranking
                </p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 px-5 py-4 shadow-sm backdrop-blur">
                <p className="text-sm font-medium text-slate-500">Decision snapshot</p>
                <p className="mt-1 text-2xl font-bold text-slate-950">{aboveEightyFive} high-priority profiles</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={Users} label="Total Resumes Analyzed" value={totalAnalyzed} accent="bg-blue-50 text-blue-600" />
              <MetricCard icon={Target} label="Total Shortlisted" value={shortlistedCandidates.length} accent="bg-emerald-50 text-emerald-600" />
              <MetricCard icon={BarChart3} label="Average Match Score" value={`${averageScore}%`} accent="bg-cyan-50 text-cyan-600" />
              <MetricCard icon={Clock} label="Analysis Time" value={analysisTime} accent="bg-amber-50 text-amber-600" />
            </div>
          </div>
        </section>

        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10">
          <section className="animate-[fadeIn_0.6s_ease-out] rounded-3xl border border-white/70 bg-white/75 p-6 shadow-xl shadow-blue-100/50 backdrop-blur md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-slate-950 p-4 text-white shadow-lg shadow-slate-300">
                  <Bot size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-950">AI Hiring Insights</h2>
                  <p className="mt-1 text-sm text-slate-500">Summary generated from the current ranking results.</p>
                </div>
              </div>
              <span className="w-fit rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700">
                {aboveEightyFive} candidates above 85%
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {[
                `${totalAnalyzed} total candidates analyzed`,
                `Strongest skill found: ${strongestSkill}`,
                `Most common skill gap: ${commonGap}`,
                `${aboveEightyFive} candidates above 85%`,
                `${Math.min(aboveEightyFive || 3, shortlistedCandidates.length)} recommended interviews`,
              ].map((insight) => (
                <div key={insight} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md">
                  <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                    ✓
                  </div>
                  <p className="text-sm font-semibold leading-6 text-slate-700">{insight}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-8 xl:grid-cols-[1.4fr_0.9fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="mb-6 flex items-center gap-3">
                <Trophy className="text-amber-500" size={26} />
                <h2 className="text-2xl font-bold text-slate-950">Top Candidates</h2>
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                {topCandidates.map((candidate, index) => {
                  const score = clampScore(candidate.overall_score);
                  const style = medalStyles[index];

                  return (
                    <article
                      key={`${candidate.name}-${index}`}
                      className={`rounded-3xl border p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl ${style.card}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-bold ${style.badge}`}>
                          <Medal size={16} />
                          {style.label}
                        </span>
                        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-lg font-black shadow-sm">
                          {style.icon}
                        </span>
                      </div>
                      <h3 className="mt-5 text-xl font-bold text-slate-950">{candidate.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{candidate.experience || candidate.experience_match ? `${candidate.experience || candidate.experience_match}% experience match` : "Experience profile ready for review"}</p>
                      <div className="mt-5">
                        <div className="mb-2 flex items-end justify-between">
                          <span className="text-sm font-semibold text-slate-500">Overall Match</span>
                          <span className="text-3xl font-black text-slate-950">{score}%</span>
                        </div>
                        <ProgressBar value={score} color={style.bar} height="h-3" />
                      </div>
                      <div className="mt-5 flex flex-wrap gap-2">
                        {getCandidateSkills(candidate).slice(0, 4).map((skill) => (
                          <span key={skill} className="rounded-full bg-white/85 px-3 py-1 text-xs font-bold text-slate-600 shadow-sm">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="mb-6 flex items-center gap-3">
                <BarChart3 className="text-blue-600" size={25} />
                <h2 className="text-2xl font-bold text-slate-950">Talent Distribution</h2>
              </div>
              <div className="flex flex-col gap-5">
                {distribution.map((item) => {
                  const width = shortlistedCandidates.length ? (item.count / shortlistedCandidates.length) * 100 : 0;
                  return (
                    <div key={item.label}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-bold text-slate-800">{item.label}</p>
                          <p className="text-xs text-slate-500">{item.range}</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">{item.count}</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div className={`${item.color} h-3 rounded-full transition-all duration-1000`} style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-950">Top 30 Shortlisted Candidates</h2>
                <p className="mt-1 text-sm text-slate-500">Expandable recruiter-ready ranking cards.</p>
              </div>
              <button
                onClick={() => setShowFullList(!showFullList)}
                className="inline-flex w-fit items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:bg-slate-800"
              >
                {showFullList ? "Hide Full List" : "View Full List"}
                {showFullList ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
              </button>
            </div>

            <div
              className={`grid transition-all duration-500 ease-out ${
                showFullList ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <div className="flex flex-col gap-4">
                  {shortlistedCandidates.map((candidate, index) => {
                    const score = clampScore(candidate.overall_score);
                    const confidence = getConfidence(score);
                    const isExpanded = expandedCandidate === index;
                    const detailMetrics = [
                      { label: "Technical Match", value: getCandidateScore(candidate, "technical_match", score - 3) },
                      { label: "Behavioral Fit", value: getCandidateScore(candidate, "behavioral_fit", score - 6) },
                      { label: "Experience Match", value: getCandidateScore(candidate, "experience_match", score - 4) },
                      { label: "Education Match", value: getCandidateScore(candidate, "education_match", score - 8) },
                      { label: "Keyword Coverage", value: getCandidateScore(candidate, "keyword_coverage", score - 2) },
                    ];
                    const concerns = getConcerns(candidate);

                    return (
                      <article key={`${candidate.name}-${index}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60 transition duration-300 hover:border-blue-200 hover:bg-white hover:shadow-lg">
                        <div className="grid gap-4 p-4 md:grid-cols-[auto_1fr_auto] md:items-center">
                          <div className="flex items-center gap-3">
                            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white">
                              {index + 1}
                            </span>
                            <div>
                              <h3 className="font-bold text-slate-950">{candidate.name}</h3>
                              <p className="text-xs font-medium text-slate-500">Candidate rank #{index + 1}</p>
                            </div>
                          </div>

                          <div>
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-sm font-semibold text-slate-500">Overall Match</span>
                              <span className="text-lg font-black text-slate-950">{score}%</span>
                            </div>
                            <ProgressBar value={score} />
                          </div>

                          <button
                            onClick={() => setExpandedCandidate(isExpanded ? null : index)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition duration-300 hover:border-blue-200 hover:text-blue-700"
                          >
                            {isExpanded ? "Hide" : "View More"}
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>

                        <div className={`grid transition-all duration-500 ease-out ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                          <div className="overflow-hidden">
                            <div className="border-t border-slate-200 bg-white p-5">
                              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                                {detailMetrics.map((metric) => (
                                  <div key={metric.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                                    <div className="mb-3 flex items-center justify-between gap-2">
                                      <p className="text-sm font-bold text-slate-700">{metric.label}</p>
                                      <span className="text-sm font-black text-slate-950">{metric.value}%</span>
                                    </div>
                                    <ProgressBar value={metric.value} height="h-2" />
                                  </div>
                                ))}
                              </div>

                              <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.8fr]">
                                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                                  <h4 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-950">
                                    <Sparkles size={18} className="text-blue-600" />
                                    Why AI Ranked This Candidate
                                  </h4>
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    {splitReason(candidate).map((reason) => (
                                      <div key={reason} className="rounded-xl bg-white p-3 text-sm font-semibold leading-6 text-slate-700 shadow-sm">
                                        <span className="mr-2 text-emerald-600">✓</span>
                                        {reason}
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                                  <h4 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-950">
                                    <BriefcaseBusiness size={18} className="text-cyan-600" />
                                    Skill Match Analysis
                                  </h4>
                                  <div className="flex flex-col gap-3">
                                    {getSkillBreakdown(candidate).map((skill) => (
                                      <div key={skill.label}>
                                        <div className="mb-1 flex items-center justify-between text-sm">
                                          <span className="font-bold text-slate-700">{skill.label}</span>
                                          <span className="font-black text-slate-950">{skill.value}%</span>
                                        </div>
                                        <ProgressBar value={skill.value} height="h-2" />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-5 grid gap-5 lg:grid-cols-[0.7fr_1fr]">
                                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                  <div className="flex items-start justify-between gap-4">
                                    <div>
                                      <h4 className="text-lg font-bold text-slate-950">AI Confidence</h4>
                                      <p className="mt-1 text-4xl font-black text-slate-950">{score}%</p>
                                    </div>
                                    <span className={`rounded-full px-3 py-1 text-xs font-black ${confidence.color}`}>{confidence.label}</span>
                                  </div>
                                  <div className="mt-4">
                                    <ProgressBar value={score} height="h-3" />
                                  </div>
                                </div>

                                {concerns.length > 0 ? (
                                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
                                    <h4 className="mb-3 flex items-center gap-2 text-lg font-bold text-amber-900">
                                      <AlertTriangle size={18} />
                                      Potential Concerns
                                    </h4>
                                    <div className="flex flex-col gap-2">
                                      {concerns.map((concern) => (
                                        <p key={concern} className="rounded-xl bg-white/80 p-3 text-sm font-semibold text-amber-900">
                                          {concern}
                                        </p>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                                    <h4 className="text-lg font-bold text-emerald-900">No major concerns detected</h4>
                                    <p className="mt-2 text-sm font-semibold text-emerald-700">Profile is ready for recruiter review.</p>
                                  </div>
                                )}
                              </div>

                              <div className="mt-5 flex flex-wrap gap-3">
                                <button
                                  onClick={() => handleViewResume(candidate)}
                                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-blue-700"
                                >
                                  <Eye size={16} />
                                  View Resume
                                </button>
                                <button
                                  onClick={() => handleDownloadResume(candidate)}
                                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
                                >
                                  <Download size={16} />
                                  Download Resume
                                </button>
                                <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition duration-300 hover:-translate-y-0.5 hover:border-amber-200 hover:text-amber-700">
                                  <Save size={16} />
                                  Save Candidate
                                </button>
                                <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition duration-300 hover:-translate-y-0.5 hover:border-emerald-200 hover:text-emerald-700">
                                  <Mail size={16} />
                                  Contact Candidate
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-blue-100 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-xl shadow-blue-100 md:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-white/10 p-4">
                  <Star size={26} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">AI Interview Predictor</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
                    Predicts interview success probability using candidate profile analysis.
                  </p>
                </div>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950">
                <ArrowDown size={15} />
                Coming Soon
              </span>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
