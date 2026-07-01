"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Sidebar from "../components/Sidebar";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// ─── helpers ──────────────────────────────────────────────────────────────────
const clamp = (n) => Math.max(0, Math.min(100, n ?? 0));
const safe  = (v, fallback = 0) => (v !== undefined && v !== null ? v : fallback);

function scoreColor(s) {
  if (s >= 70) return { bar: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" };
  if (s >= 40) return { bar: "bg-orange-400",  text: "text-orange-700",  bg: "bg-orange-50",  border: "border-orange-200"  };
  return              { bar: "bg-red-500",      text: "text-red-700",     bg: "bg-red-50",     border: "border-red-200"     };
}

// ─── Effective Role Alignment (override backend) ──────────────
function getEffectiveRoleAlignment(candidate) {
  // If backend score is reasonable (>30), use it
  const backendScore = candidate.role_alignment_score;
  if (backendScore !== undefined && backendScore !== null && backendScore > 30) {
    return backendScore;
  }
  
  // Otherwise compute a better proxy from other metrics
  const skillMatch = candidate.skill_match || 0;
  const careerRel = candidate.career_relevance || 0;
  const expMatch = candidate.experience_match || 0;
  const specializationPenalty = candidate.specialization_penalty || 1;
  
  let computed = (skillMatch * 0.5) + (careerRel * 0.3) + (expMatch * 0.2);
  
  if (specializationPenalty < 0.8) {
    computed = computed * specializationPenalty;
  }
  
  return Math.min(100, Math.max(0, Math.round(computed)));
}

function absoluteScoreColor(s) {
  if (s >= 70) return { bar: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" };
  if (s >= 40) return { bar: "bg-orange-400",  text: "text-orange-700",  bg: "bg-orange-50",  border: "border-orange-200"  };
  return              { bar: "bg-red-500",      text: "text-red-700",     bg: "bg-red-50",     border: "border-red-200"     };
}

function badge(s) {
  if (s >= 85) return { label: "Interview Ready",  cls: "bg-emerald-100 text-emerald-700 border border-emerald-200" };
  if (s >= 70) return { label: "Strong Candidate", cls: "bg-blue-100 text-blue-700 border border-blue-200"         };
  if (s >= 55) return { label: "Needs Review",     cls: "bg-amber-100 text-amber-700 border border-amber-200"      };
  return              { label: "Not Recommended",  cls: "bg-red-100 text-red-700 border border-red-200"            };
}

function _recruiterComposite(c) {
  const s    = clamp(safe(c.overall_score    ?? c.display_score, 0)) / 100;
  const ev   = clamp(safe(c.evidence_score,    c.credibility_score ?? 50)) / 100;
  const cred = clamp(safe(c.credibility_score, 50)) / 100;
  const proj = clamp(safe(c.project_quality_score, 0))  / 100;
  const expf = clamp(safe(c.experience_fit_score,  60)) / 100;
  const conf = c.confidence_level === "High" ?  0.06
             : c.confidence_level === "Low"  ? -0.05
             : 0;
  return Math.min(1, Math.max(0,
    s    * 0.38 +
    ev   * 0.24 +
    cred * 0.18 +
    proj * 0.10 +
    expf * 0.10 +
    conf
  ));
}

function _recNote(c, label, composite, rankStr, poolIsWeak) {
  const ev   = clamp(safe(c.evidence_score,    c.credibility_score ?? 50));
  const cred = clamp(safe(c.credibility_score, 50));
  const proj = safe(c.project_quality_score, 0);

  const evidenceStrong = ev >= 65 && cred >= 60;
  const evidenceWeak   = ev <  35 || cred <  40;
  const projStrong     = proj >= 55;

  if (label === "Strong Interview") {
    if (projStrong && evidenceStrong)
      return "Exceptional overall fit backed by production-grade project evidence and well-validated skills.";
    if (evidenceStrong)
      return "Outstanding job fit with strong evidence quality — skills are thoroughly backed by project and work history.";
    if (rankStr && poolIsWeak)
      return `Highest-ranked candidate in the current applicant pool. ${evidenceStrong ? "Evidence quality further supports this recommendation." : "Strongest available option despite a moderate-scoring pool."}`;
    return "Outstanding candidate across job fit, evidence quality, and profile credibility.";
  }

  if (label === "Interview") {
    if (rankStr && poolIsWeak)
      return `Ranks ${rankStr} — competitive within this pool. Recommendation is relative to available applicants.`;
    if (evidenceWeak)
      return "Good overall fit. Evidence backing is limited — verify skills during interview.";
    if (rankStr)
      return `Ranks ${rankStr} with solid overall fit and credible evidence.`;
    return "Good overall job fit supported by evidence and credibility signals.";
  }

  if (label === "Good Fit") {
    return "This candidate may have ranked lower for this specific role, but still shows solid engineering ability and credible evidence. Worth a look.";
  }

  if (label === "Review Carefully") {
    if (evidenceWeak)
      return "Candidate shows relevant background but evidence is limited. Review project history before proceeding.";
    if (rankStr)
      return `Ranks ${rankStr} — mixed signals across hiring dimensions warrant manual review before proceeding.`;
    return "Mixed profile with noticeable gaps in evidence or fit. Recruiter review recommended.";
  }

  // Not Recommended
  return "Low overall job fit with limited evidence and poor relative standing in this applicant pool.";
}

// ─── UPDATED: Recruiter‑friendly recommendation assignment with "Good Fit" ──

function assignRecommendations(allRankings) {
  const map = new Map();
  if (!allRankings || allRankings.length === 0) return map;

  for (const c of allRankings) {
    const rank = c.rank ?? (allRankings.indexOf(c) + 1);
    const isHoneypot = c.is_honeypot ?? false;

    if (isHoneypot) {
      map.set(c.candidate_id, {
        label: "Do Not Interview",
        icon: "🚫",
        cls: "bg-red-100 text-red-700 border-red-300",
        note: "Suspicious pattern – do not proceed.",
      });
      continue;
    }

    const evidence    = clamp(c.evidence_score ?? 50);
    const credibility = clamp(c.credibility_score ?? 50);
    const projQual    = clamp(c.project_quality_score ?? 0);
    const roleAlign   = clamp(c.role_alignment_score ?? 50);
    const conf        = c.confidence_level ?? "Moderate";
    const flags       = Array.isArray(c.credibility_flags) ? c.credibility_flags : [];

    const seriousIssue = (flags.length >= 2 || credibility < 25 || (conf === "Low" && evidence < 20));
    const strongEvidence = (evidence >= 55 && credibility >= 55 && projQual >= 35 && roleAlign >= 45 && conf !== "Low");
    const goodEvidence   = (evidence >= 35 && credibility >= 35 && projQual >= 15 && conf !== "Low");

    let label, icon, cls, note;

    if (rank <= 5) {
      label = seriousIssue ? "Review Carefully" : "Strong Interview";
      icon = seriousIssue ? "⚠️" : "✅";
      cls = seriousIssue ? "bg-orange-100 text-orange-700 border-orange-300" : "bg-emerald-100 text-emerald-700 border-emerald-300";
      note = seriousIssue ? "Top rank but flagged – manual review" : "Top tier – excellent fit";
    } else if (rank <= 15) {
      // Ranks 6–15: default Interview, upgrade to Strong if exceptional, downgrade if weak
      if (strongEvidence) {
        label = "Strong Interview";
        icon = "✅";
        cls = "bg-emerald-100 text-emerald-700 border-emerald-300";
        note = "Exceptional evidence – upgrade";
      } else if (evidence < 20 || credibility < 25) {
        label = "Review Carefully";
        icon = "⚠️";
        cls = "bg-orange-100 text-orange-700 border-orange-300";
        note = "Competitive rank but weak evidence";
      } else {
        label = "Interview";
        icon = "👍";
        cls = "bg-blue-100 text-blue-700 border-blue-300";
        note = "Strong fit – interview";
      }
    } else if (rank <= 30) {
      // Ranks 16–30: default Review Carefully, upgrade to Good Fit or Interview based on evidence
      if (strongEvidence) {
        label = "Interview";
        icon = "👍";
        cls = "bg-blue-100 text-blue-700 border-blue-300";
        note = "Exceptional evidence – interview recommended";
      } else if (goodEvidence) {
        label = "Good Fit";
        icon = "🌟";
        cls = "bg-purple-100 text-purple-700 border-purple-300";
        note = "Solid evidence but lower rank – worth a look";
      } else if (evidence < 15 || credibility < 20) {
        label = "Not Recommended";
        icon = "❌";
        cls = "bg-red-100 text-red-700 border-red-300";
        note = "Very weak profile";
      } else {
        label = "Review Carefully";
        icon = "⚠️";
        cls = "bg-orange-100 text-orange-700 border-orange-300";
        note = "Mixed signals – review";
      }
    } else {
      // rank > 30
      if (credibility >= 70 && !seriousIssue) {
        label = "Review Carefully";
        icon = "⚠️";
        cls = "bg-orange-100 text-orange-700 border-orange-300";
        note = "High credibility – worth a look";
      } else if (evidence >= 40 && credibility >= 40) {
        label = "Review Carefully";
        icon = "⚠️";
        cls = "bg-orange-100 text-orange-700 border-orange-300";
        note = "Some evidence – second look";
      } else if (evidence < 15 || credibility < 20) {
        label = "Not Recommended";
        icon = "❌";
        cls = "bg-red-100 text-red-700 border-red-300";
        note = "Insufficient evidence";
      } else {
        label = "Not Recommended";
        icon = "❌";
        cls = "bg-red-100 text-red-700 border-red-300";
        note = "Limited fit";
      }
    }

    // Never reject high credibility
    if (credibility >= 70 && label === "Not Recommended" && !seriousIssue) {
      label = "Review Carefully";
      note = "High credibility – reconsider";
    }
    if (rank > 30 && label === "Strong Interview") label = "Review Carefully";

    map.set(c.candidate_id, { label, icon, cls, note });
  }

  return map;
}

// ─── Rest of helpers (unchanged) ─────────────────────────────────────────────

function confidenceLabel(level, credibility, evidenceScore) {
  const cred = safe(credibility, 0);
  const ev   = safe(evidenceScore, 0);
  const evidenceBased = (cred >= 75 && ev >= 65);
  const moderateBased = (cred >= 50 || ev >= 45);

  if (level === "High" || evidenceBased)
    return {
      label: "High Confidence",
      cls: "bg-emerald-100 text-emerald-700 border-emerald-200",
      note: "Skills are well-supported by project and work experience evidence.",
    };
  if (level === "Moderate" || moderateBased)
    return {
      label: "Moderate Confidence",
      cls: "bg-amber-100 text-amber-800 border-amber-200",
      note: "Some skills have evidence backing; others are listed without verification.",
    };
  return {
    label: "Low Confidence",
    cls: "bg-red-100 text-red-700 border-red-200",
    note: "Limited supporting evidence detected. Verify claims before proceeding.",
  };
}

function parseReason(reason) {
  if (!reason) return [];
  if (reason.includes("Strengths:") || reason.includes("Concerns:")) return [reason];
  return reason
    .split(/[.;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8)
    .slice(0, 5);
}

function parseReasoningBlocks(reason) {
  if (!reason) return { strengths: [], concerns: [] };
  const strengthMatch = reason.match(/Strengths:\s*(.+?)(?=Concerns:|$)/s);
  const concernMatch  = reason.match(/Concerns:\s*(.+?)$/s);

  const parseSection = (raw) =>
    raw ? raw.split("|").map((s) => s.trim()).filter(Boolean) : [];

  return {
    strengths: parseSection(strengthMatch?.[1]),
    concerns:  parseSection(concernMatch?.[1]),
  };
}

function BoldText({ text }) {
  if (!text || !text.includes("**")) return <span>{text}</span>;
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <span>
      {parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
      )}
    </span>
  );
}

function SpecializationBadge({ primary, secondary, penalty }) {
  if (!primary || primary === "general") return null;
  const domainColors = {
    frontend:  "bg-blue-100 text-blue-700 border-blue-200",
    backend:   "bg-violet-100 text-violet-700 border-violet-200",
    devops:    "bg-orange-100 text-orange-700 border-orange-200",
    data:      "bg-cyan-100 text-cyan-700 border-cyan-200",
    ai:        "bg-purple-100 text-purple-700 border-purple-200",
    uiux:      "bg-pink-100 text-pink-700 border-pink-200",
    fullstack: "bg-teal-100 text-teal-700 border-teal-200",
  };
  const cls = domainColors[primary] ?? "bg-gray-100 text-gray-700 border-gray-200";
  const penaltyNum = penalty !== undefined ? Math.round(penalty * 100) : null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
        🎯 {primary.charAt(0).toUpperCase() + primary.slice(1)} Specialist
      </span>
      {secondary && (
        <span className="text-[10px] text-gray-500 border border-gray-200 bg-gray-50 px-2 py-0.5 rounded-full">
          2nd: {secondary.charAt(0).toUpperCase() + secondary.slice(1)}
        </span>
      )}
      {penaltyNum !== null && penaltyNum < 100 && (
        <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
          ⚠ Specialization match: {penaltyNum}%
        </span>
      )}
    </div>
  );
}

// ─── animated progress bar ────────────────────────────────────────────────────
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

// ─── metric card (unchanged) ──────────────────────────────────────────────────
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

// ─── Trust Signal Bar ─────────────────────────────────────────────────────
function TrustBar({ label, value, delay = 0 }) {
  const v = clamp(safe(value, 0));
  const c = absoluteScoreColor(v);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        <span className={`text-xs font-bold ${c.text}`}>{v}%</span>
      </div>
      <Bar value={v} colorClass={c.bar} delay={delay} height="h-1.5" />
    </div>
  );
}

// ─── Specialization Alignment Panel ─────────────────────────────────────
function SpecializationPanel({ candidate }) {
  const c = candidate;
  if (!c.primary_specialization || c.primary_specialization === "general") return null;
  const penaltyPct = c.specialization_penalty !== undefined
    ? Math.round(c.specialization_penalty * 100)
    : null;
  const isMatch = penaltyPct === 100;
  const isWeak  = penaltyPct !== null && penaltyPct < 60;

  return (
    <div className={`rounded-xl border px-4 py-3 mb-3 ${isMatch ? "bg-emerald-50 border-emerald-200" : isWeak ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
      <p className="text-xs font-bold uppercase tracking-wider mb-2 text-gray-700">Career Specialization</p>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-700">Primary:</span>
          <span className={`text-xs font-bold ${isMatch ? "text-emerald-700" : isWeak ? "text-red-700" : "text-amber-700"}`}>
            {c.primary_specialization.charAt(0).toUpperCase() + c.primary_specialization.slice(1)}
          </span>
          {penaltyPct !== null && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${isMatch ? "bg-emerald-100 text-emerald-700 border-emerald-200" : isWeak ? "bg-red-100 text-red-700 border-red-200" : "bg-amber-100 text-amber-700 border-amber-200"}`}>
              Specialization match: {penaltyPct}%
            </span>
          )}
        </div>
        {c.secondary_specialization && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Secondary exposure:</span>
            <span className="text-xs font-medium text-gray-700">{c.secondary_specialization.charAt(0).toUpperCase() + c.secondary_specialization.slice(1)}</span>
          </div>
        )}
        {c.career_trajectory && (
          <p className="text-xs text-gray-600 italic">"{c.career_trajectory}"</p>
        )}
        {isWeak && (
          <p className="text-[11px] text-red-700 font-medium mt-1">
            ⚠ This candidate's career identity does not align with the target role. High scores in other dimensions cannot compensate for a fundamental specialization mismatch.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Recruiter Intelligence Panel ────────────────────────────────────────
function RecruiterIntelPanel({ candidate, recMap = new Map() }) {
  const c = candidate;
  const { strengths: parsedStrengths, concerns: parsedConcerns } = parseReasoningBlocks(c.reason ?? c.reasoning ?? "");

  const strengths = (Array.isArray(c.strengths) && c.strengths.length)
    ? c.strengths
    : parsedStrengths;
  const concerns  = (Array.isArray(c.concerns) && c.concerns.length)
    ? c.concerns
    : parsedConcerns;

  const evidenceScore  = safe(c.evidence_score, null);
  const credibility    = safe(c.credibility_score, null);
  const skillCount     = c.matched_skills?.length ?? 0;
  const isHoneypot     = c.is_honeypot ?? false;

  const validatedCountRaw = c.validated_skill_count !== undefined && c.validated_skill_count !== null
    ? c.validated_skill_count
    : (evidenceScore !== null ? Math.round((evidenceScore / 100) * skillCount) : null);
  // Backend's validated_skill_count is sometimes computed against a different
  // skill list than matched_skills, which can produce impossible ratios like
  // 9/8 or 14/8. Clamp it so the displayed count never exceeds the denominator.
  const validatedCount = validatedCountRaw !== null ? Math.min(validatedCountRaw, skillCount) : null;

  const evidenceBullets = [];
  if (validatedCount !== null) {
    evidenceBullets.push(`${validatedCount} of ${skillCount} matched skills supported by project or work history`);
  }
  if (c.validated_skill_ratio !== undefined && c.validated_skill_ratio !== null) {
    const ratio = clamp(c.validated_skill_ratio);
    if (ratio >= 75)      evidenceBullets.push(`${ratio}% of listed skills are directly verifiable through project or work history`);
    else if (ratio >= 40) evidenceBullets.push(`${ratio}% of listed skills have some supporting evidence`);
    else                  evidenceBullets.push(`${ratio}% of listed skills have verifiable evidence — remaining skills are listed only`);
  }
  if (credibility !== null) {
    if (credibility >= 80) evidenceBullets.push("Profile credibility is high — skills appear consistently across profile sections");
    else if (credibility >= 55) evidenceBullets.push("Profile credibility is moderate — some skills lack supporting context");
    else evidenceBullets.push("Profile credibility is lower — several skills may lack sufficient evidence");
  }
  if (!isHoneypot && credibility !== null && credibility >= 75)
    evidenceBullets.push("Low keyword stuffing risk detected");
  if (isHoneypot)
    evidenceBullets.push("⚠ Potential keyword stuffing pattern detected");

  const flags = Array.isArray(c.credibility_flags) ? c.credibility_flags : [];

  const rec   = recMap.get(c.candidate_id) ?? hiringRecommendation(
    c.overall_score ?? c.display_score,
    credibility,
    isHoneypot,
    c.rank ?? null,
    c.percentile_rank ?? null,
    null,
    c.evidence_score ?? null,
    c.project_quality_score ?? null,
    c.experience_fit_score ?? null,
    c.confidence_level ?? null
  );

  return (
    <div className="space-y-4">

      {/* Specialization Alignment (new) */}
      <SpecializationPanel candidate={c} />

      {/* Hiring Recommendation */}
      <div className={`rounded-xl border px-4 py-3 border ${rec.cls}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">Hiring Recommendation</p>
            <p className="font-bold text-sm mt-0.5">{rec.icon} {rec.label}</p>
          </div>
          {c.confidence_level && (
            <span className="text-[10px] font-medium bg-white/60 border border-current/20 px-2 py-1 rounded-full opacity-80">
              {c.confidence_level} Confidence
            </span>
          )}
        </div>
        {rec.note && (
          <p className="text-[11px] mt-2 leading-snug opacity-75 border-t border-current/10 pt-2">
            {rec.note}
          </p>
        )}
      </div>

      {/* Low match explanation — why a low-JD-match candidate still ranks here */}
      {c.low_match_explanation && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mb-1">Why This Candidate Ranks Here</p>
          <p className="text-xs text-gray-700 leading-snug">{c.low_match_explanation}</p>
        </div>
      )}

      {/* Strengths */}
      {strengths.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Strengths</p>
          <div className="space-y-1.5">
            {strengths.slice(0, 5).map((s, i) => (
              <div key={i} className="flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
                <span className="w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">✓</span>
                <p className="text-sm text-gray-800 leading-relaxed"><BoldText text={s} /></p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidence Validation */}
      {(evidenceBullets.length > 0 || flags.length > 0) && (
        <div>
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Evidence Validation</p>
          <div className="space-y-1.5">
            {evidenceBullets.map((b, i) => (
              <div key={i} className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
                <span className="text-blue-500 text-xs flex-shrink-0 mt-0.5">🔍</span>
                <p className="text-sm text-gray-800 leading-relaxed">{b}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Potential Concerns */}
      {(concerns.length > 0 || flags.length > 0) && (
        <div>
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Potential Concerns</p>
          <div className="space-y-1.5">
            {[...concerns, ...flags].slice(0, 4).map((s, i) => (
              <div key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                <span className="text-amber-500 text-xs flex-shrink-0 mt-0.5">⚠</span>
                <p className="text-sm text-gray-800 leading-relaxed"><BoldText text={s} /></p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Why ranked above similar — driven by comparison engine */}
      {c.comparison_vs_next?.reasons_a_higher?.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Why Ranked Above Next Candidate</p>

          {/* Narrative summary (new field) */}
          {c.comparison_vs_next.narrative && (
            <p className="text-xs text-gray-500 italic mb-2 px-1 leading-snug">
              {c.comparison_vs_next.narrative}
            </p>
          )}

          {/* Top differentiator callout (new field) */}
          {c.comparison_vs_next.top_differentiator && (
            <div className="flex items-start gap-2 bg-blue-600 rounded-xl px-3 py-2.5 mb-2">
              <span className="text-white text-xs font-bold flex-shrink-0 mt-0.5">★</span>
              <p className="text-xs text-white font-medium leading-snug">
                {c.comparison_vs_next.top_differentiator}
              </p>
            </div>
          )}

          {/* Full reasons list */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 space-y-1.5">
            {c.comparison_vs_next.reasons_a_higher.slice(0, 4).map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-gray-700">
                <span className="text-blue-500 font-bold flex-shrink-0 mt-0.5">•</span>
                <span>{r}</span>
              </div>
            ))}
          </div>

          {/* Why next candidate is weaker (reasons_b_higher = next candidate's advantages — shown as "areas to watch") */}
          {c.comparison_vs_next.reasons_b_higher?.length > 0 &&
           c.comparison_vs_next.reasons_b_higher[0] !== "Candidates demonstrate similar technical qualifications; ranking was influenced by stronger evidence validation and overall profile consistency." && (
            <div className="mt-2">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Next Candidate's Relative Strengths</p>
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 space-y-1.5">
                {c.comparison_vs_next.reasons_b_higher.slice(0, 2).map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="text-amber-500 font-bold flex-shrink-0 mt-0.5">•</span>
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Impressive Project Evidence Card ─────────────────────────────────────
function StarRating({ rating }) {
  if (!rating) return null;
  const filled = (rating.match(/★/g) || []).length;
  const empty  = 5 - filled;
  return (
    <span className="text-lg leading-none tracking-tight select-none" aria-label={`${filled} out of 5 stars`}>
      <span className="text-amber-400">{"★".repeat(filled)}</span>
      <span className="text-gray-300">{"★".repeat(empty)}</span>
    </span>
  );
}

function ImpressiveProjectCard({ candidate }) {
  const ev = candidate.impressive_project_evidence;
  const score = candidate.project_quality_score;
  const stars = candidate.project_star_rating;

  if (!ev || score === undefined || score === null) return null;
  if (score < 15) return null;

  const technologies = ev.key_technologies ?? ev.all_signals ?? [];
  const impacts      = ev.impact_highlights ?? [];
  const label        = ev.best_label ?? "";
  const sourceType   = ev.best_type ?? "project";
  const whyMatters   = ev.why_it_matters ?? "";

  const sc = score >= 75
    ? { bg: "bg-gradient-to-br from-amber-50 to-yellow-50", border: "border-amber-300", headerBg: "bg-amber-500", headerText: "text-white", scoreBadge: "bg-amber-100 text-amber-800 border-amber-300" }
    : score >= 50
    ? { bg: "bg-gradient-to-br from-blue-50 to-indigo-50",  border: "border-blue-200",  headerBg: "bg-blue-600",  headerText: "text-white", scoreBadge: "bg-blue-100 text-blue-800 border-blue-200"  }
    : { bg: "bg-gradient-to-br from-slate-50 to-gray-50",   border: "border-slate-200", headerBg: "bg-slate-500", headerText: "text-white", scoreBadge: "bg-slate-100 text-slate-700 border-slate-200" };

  return (
    <div className={`rounded-xl border ${sc.border} ${sc.bg} overflow-hidden`}>

      {/* Header bar */}
      <div className={`${sc.headerBg} ${sc.headerText} px-4 py-2.5 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className="text-base">🏆</span>
          <span className="text-xs font-bold uppercase tracking-wider">Most Impressive Project Evidence</span>
        </div>
        <div className="flex items-center gap-2">
          <StarRating rating={stars} />
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${sc.scoreBadge}`}>
            {score}/100
          </span>
        </div>
      </div>

      <div className="p-4 space-y-3">

        {/* Source label */}
        {label && (
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
              {sourceType === "project" ? "Top Project" : "Strongest Work Evidence"}
            </p>
            <p className="text-sm font-bold text-gray-800 leading-snug">{label}</p>
          </div>
        )}

        {/* Key Technologies */}
        {technologies.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Key Technologies</p>
            <div className="flex flex-wrap gap-1.5">
              {technologies.slice(0, 8).map((tech, i) => (
                <span
                  key={i}
                  className="text-[11px] font-medium bg-white border border-gray-200 text-gray-700 px-2.5 py-1 rounded-lg shadow-sm"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Impact Highlights */}
        {impacts.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Impact Highlights</p>
            <div className="space-y-1">
              {impacts.map((impact, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold text-xs flex-shrink-0 mt-0.5">↑</span>
                  <span className="text-xs text-gray-700 capitalize leading-snug">{impact}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Why It Matters */}
        {whyMatters && (
          <div className="bg-white/70 border border-white rounded-lg px-3 py-2.5">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Why Recruiters Care</p>
            <p className="text-xs text-gray-700 leading-snug">{whyMatters}</p>
          </div>
        )}

        {/* No impact / no tech fallback */}
        {technologies.length === 0 && impacts.length === 0 && (
          <p className="text-xs text-gray-500 italic">Basic project evidence found — limited production-grade signals detected.</p>
        )}

      </div>
    </div>
  );
}

// ─── Recruiter Trust Panel ───────────────────────────────────────────────
function _trustContext(label, value) {
  const v = Math.round(value ?? 0);
  if (label === "Specialization Fit") {
    if (v >= 100) return "Primary specialization directly matches this role — career identity aligns.";
    if (v >= 75)  return "Adjacent specialization with meaningful overlap for this role.";
    if (v >= 55)  return "Secondary exposure exists but primary specialization differs from role.";
    return "Primary specialization is a significant mismatch for this role type.";
  }
  if (label === "Evidence Score") {
    if (v >= 80) return "All matched skills verified through projects and experience.";
    if (v >= 50) return "Most skills have supporting project or work evidence.";
    return "Limited supporting evidence for listed skills.";
  }
  if (label === "Role Alignment") {
    if (v >= 70) return "Career history strongly aligns with this role type.";
    if (v >= 40) return "Career background shows partial alignment with this role.";
    return "Limited direct alignment with the target role.";
  }
  if (label === "Experience Fit") {
    if (v >= 85) return "Experience level closely matches the role requirements.";
    if (v >= 65) return "Experience level is a reasonable fit for this position.";
    return "Experience level diverges from role requirements.";
  }
  if (label === "Profile Credibility") {
    if (v >= 85) return "Technical claims are consistent and well-supported.";
    if (v >= 60) return "Most claims are credible with minor gaps.";
    return "Some profile claims lack sufficient supporting evidence.";
  }
  if (label === "Validated Skill Ratio") {
    if (v >= 75) return "High proportion of skills independently verifiable.";
    if (v >= 40) return "Moderate proportion of skills have evidence backing.";
    return "Many skills are listed without supporting evidence.";
  }
  if (label === "Career Consistency") {
    if (v >= 70) return "Consistent professional trajectory throughout career.";
    if (v >= 40) return "Career shows moderate domain consistency.";
    return "Career history contains unrelated roles.";
  }
  if (label === "Project Relevance") {
    if (v >= 70) return "Project portfolio is highly relevant to this role.";
    if (v >= 40) return "Some projects align with the role requirements.";
    return "Limited relevant project work found.";
  }
  if (label === "Project Quality") {
    if (v >= 75) return "Strong production-grade engineering — distributed systems, cloud, or AI/ML depth.";
    if (v >= 45) return "Moderate engineering depth with some production signals.";
    return "Limited evidence of production-scale or complex engineering.";
  }
  return null;
}

function RecruiterTrustPanel({ candidate }) {
  const c = candidate;
  const hasNewFields = c.evidence_score !== undefined || c.role_alignment_score !== undefined;
  if (!hasNewFields) return null;

  const specFitValue = c.specialization_penalty !== undefined
    ? Math.round(c.specialization_penalty * 100)
    : undefined;

  const items = [
    { label: "Specialization Fit",     value: specFitValue },
    { label: "Role Alignment", value: getEffectiveRoleAlignment(c) },
    { label: "Evidence Score",         value: c.evidence_score },
    { label: "Experience Fit",         value: c.experience_fit_score },
    { label: "Profile Credibility",    value: c.credibility_score },
    { label: "Validated Skill Ratio",  value: c.validated_skill_ratio },
    { label: "Career Consistency",     value: c.career_consistency_score },
    { label: "Project Relevance",      value: c.project_relevance_score },
    { label: "Project Quality",        value: c.project_quality_score },
  ].filter((item) => item.value !== undefined && item.value !== null);

  if (!items.length) return null;

  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
      <p className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3">Recruiter Trust Signals</p>
      <div className="space-y-3">
        {items.map((item, i) => {
          const ctx = _trustContext(item.label, item.value);
          return (
            <div key={item.label}>
              <TrustBar label={item.label} value={item.value} delay={i * 70} />
              {ctx && <p className="text-xs text-gray-600 font-medium mt-1 leading-snug pl-0.5">{ctx}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── AI Confidence Card ──────────────────────────────────────────────────────
function AIConfidenceCard({ candidate }) {
  const c = candidate;
  const conf = confidenceLabel(
    c.confidence_level,
    c.credibility_score,
    c.evidence_score
  );

  const legacyPct = Math.min(
    Math.round(
      (clamp(c.technical_match || 0) + clamp(c.behavioral_fit || 0) + clamp(c.experience_match || 0)) / 3
    ),
    99
  );
  const hasNewConf = c.confidence_level !== undefined;

  const insights = [];
  if (c.evidence_score !== undefined) {
    const ev = clamp(c.evidence_score);
    if (ev >= 80)      insights.push(`Evidence Score ${ev}% — all matched skills independently verified through projects and work experience.`);
    else if (ev >= 55) insights.push(`Evidence Score ${ev}% — most matched skills are supported by project or professional evidence.`);
    else               insights.push(`Evidence Score ${ev}% — limited supporting evidence for listed skills. Recommend verification.`);
  }
  if (c.credibility_score !== undefined) {
    const cr = clamp(c.credibility_score);
    if (cr >= 85)      insights.push(`Credibility ${cr}% — technical claims are consistent and well-supported across the profile.`);
    else if (cr >= 60) insights.push(`Credibility ${cr}% — most claims are credible; some gaps exist.`);
    else               insights.push(`Credibility ${cr}% — profile credibility is below average. Some claims may be overstated.`);
  }
  if (c.validated_skill_ratio !== undefined) {
    const vr = clamp(c.validated_skill_ratio);
    insights.push(`${vr}% of matched skills are directly verifiable through project or work history.`);
  }

  return (
    <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl p-4 border border-blue-100">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Evidence Confidence</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Independent of rank — reflects evidence quality only</p>
        </div>
        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${conf.cls}`}>
          {conf.label}
        </span>
      </div>
      {hasNewConf ? (
        <div className="space-y-1.5 mt-2">
          {insights.map((line, i) => (
            <p key={i} className="text-xs text-gray-700 leading-snug">{line}</p>
          ))}
          {!insights.length && <p className="text-xs text-gray-700 leading-snug">{conf.note}</p>}
        </div>
      ) : (
        <p className="text-2xl font-black text-slate-900">{legacyPct}%</p>
      )}
    </div>
  );
}

// ─── Evidence Sources Card ───────────────────────────────────────────────
function EvidenceSourcesCard({ candidate }) {
  const sources = candidate.evidence_sources;
  if (!Array.isArray(sources) || !sources.length) return null;

  const strengthStyle = {
    Strong:   { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100" },
    Moderate: { dot: "bg-amber-400",   text: "text-amber-700",   bg: "bg-amber-50 border-amber-100"     },
    Weak:     { dot: "bg-red-400",     text: "text-red-600",     bg: "bg-red-50 border-red-100"          },
  };

  return (
    <div>
      <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3">Evidence Sources</h4>
      <div className="space-y-2">
        {sources.map((entry, i) => {
          const s  = strengthStyle[entry.strength] ?? strengthStyle.Weak;
          return (
            <div key={i} className={`rounded-xl border px-4 py-3 ${s.bg}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                <span className="text-xs font-bold text-gray-800">{entry.skill}</span>
                <span className={`ml-auto text-[10px] font-semibold ${s.text}`}>
                  Evidence: {entry.strength}
                </span>
              </div>
              <div className="pl-4 space-y-0.5">
                {entry.sources.map((src, j) => (
                  <div key={j} className="flex items-start gap-1.5 text-[11px] text-gray-600">
                    <span className="text-gray-400 flex-shrink-0 mt-0.5">•</span>
                    <span>{src}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Skills Analysis ───────────────────────────────────────────────────
function SkillsAnalysis({ candidate }) {
  const c = candidate;
  if (!c.skills?.length) return null;

  const matchedSet = new Set((c.matched_skills ?? []).map((s) => s.toLowerCase()));

  return (
    <div>
      <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3">Matched Skills Analysis</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {c.skills.slice(0, 6).map((sk, si) => {
          const skillScore = c.skill_scores?.[sk] ?? 0;
          const skc        = absoluteScoreColor(skillScore);
          const isMatched  = matchedSet.has(sk.toLowerCase());

          let sublabel;
          if (isMatched && skillScore === 100) sublabel = "Validated by evidence";
          else if (isMatched && skillScore >= 65) sublabel = "Matched — some evidence";
          else if (isMatched) sublabel = "Matched — listed only";
          else sublabel = "Listed — weak evidence";

          return (
            <div key={sk} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-gray-800 truncate max-w-[70%]">{sk}</span>
                <span className={`text-sm font-black ${skc.text}`}>{skillScore}%</span>
              </div>
              <Bar value={skillScore} colorClass={skc.bar} delay={si * 60} height="h-1.5" />
              <p className="text-xs text-gray-600 font-medium mt-1.5">{sublabel}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Score presentation helpers ──────────────────────────────────────────────

function computePercentile(candidate, allRankings) {
  if (!allRankings?.length) return null;
  if (candidate.percentile_rank !== undefined && candidate.percentile_rank !== null) {
    return Math.round(candidate.percentile_rank);
  }
  const total = allRankings.length;
  const rank  = candidate.rank ?? 1;
  if (total === 1) return 100;
  return Math.round(100 * (total - rank) / (total - 1));
}

function ordinal(n) {
  const s = ["th","st","nd","rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function buildRankingContextNote(candidate, allRankings) {
  const notes = [];
  const projRel   = safe(candidate.project_relevance_score, null);
  const roleAlign = safe(candidate.role_alignment_score,    null);
  const evidence  = safe(candidate.evidence_score,          null);
  const skillPct  = safe(candidate.skill_match,             null);
  const dispScore = clamp(candidate.overall_score ?? candidate.display_score);
  const total     = allRankings?.length ?? 0;
  const rank      = candidate.rank ?? 1;

  if (projRel !== null && projRel < 35 && dispScore >= 60) {
    notes.push("Professional experience compensates for limited project evidence.");
  }
  if (skillPct !== null && skillPct < 45 && dispScore >= 60) {
    notes.push("Strong role alignment and evidence quality drive this ranking despite partial skill overlap.");
  }
  if (total > 5 && rank <= Math.ceil(total * 0.30) && dispScore < 65) {
    const band = dispScore < 30 ? "low" : dispScore < 50 ? "below average" : "moderate";
    notes.push(
      `Ranks ${ordinal(rank)} of ${total} — this is a relative ranking. The absolute match score of ${dispScore}% reflects ` +
      `the actual job fit, which is ${band}.`
    );
  }
  if (rank <= 3 && skillPct !== null && skillPct < 55 && roleAlign !== null && roleAlign >= 65) {
    notes.push("Ranked highly due to strong role alignment and evidence quality, not keyword coverage alone.");
  }
  return notes;
}

// ─── main component ────────────────────────────────────────────────────────────
function ResultsInner() {
  const searchParams       = useSearchParams();
  const fromRankingId      = searchParams.get("from");

  const [results,           setResults           ] = useState(null);
  const [expandedCandidate, setExpandedCandidate ] = useState(null);
  const [showFullList,      setShowFullList       ] = useState(false);
  const [savedCandidates,   setSavedCandidates    ] = useState([]);
  const [searchQuery,       setSearchQuery        ] = useState("");
  const [sortBy,            setSortBy             ] = useState("display_score");
  const [mounted,           setMounted            ] = useState(false);
  const [activeTab,         setActiveTab          ] = useState("shortlisted");

  useEffect(() => {
    setMounted(true);

    // If we arrived via a specific ranking link (e.g. the Top Candidate
    // card on the dashboard, or "View ranking" from recent activity),
    // fetch THAT exact ranking from the backend instead of whatever is
    // sitting in localStorage (which is just the most recently run one).
    if (fromRankingId) {
      fetch(`${API_BASE}/rankings/${fromRankingId}`)
        .then((res) => {
          if (!res.ok) throw new Error("Ranking not found");
          return res.json();
        })
        .then((data) => setResults(data))
        .catch(() => {
          // Fall back to localStorage if the specific ranking couldn't be loaded
          const data = localStorage.getItem("rankingResults");
          if (data) setResults(JSON.parse(data));
        });
      return;
    }

    const data = localStorage.getItem("rankingResults");
    if (data) setResults(JSON.parse(data));
  }, [fromRankingId]);

  const handleViewResume = (candidate) => {
    if (candidate.resume_url) {
      window.open(encodeURI(candidate.resume_url), "_blank");
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

  const exportCSV = () => {
    const candidates = results?.rankings || [];
    if (!candidates.length) return;

    const recMapLocal = assignRecommendations(candidates);

    const headers = [
      "Rank", "Name", "Current Title", "Experience (yrs)",
      "Overall Score", "Skill Match", "Role Alignment", "Evidence Score",
      "Credibility Score", "Project Quality", "Experience Fit",
      "Confidence Level", "Recommendation", "Skills", "Is Honeypot",
    ];

    const rows = candidates.map((c) => {
      const rec = recMapLocal.get(c.candidate_id);
      return [
        c.rank ?? "",
        c.name ?? "",
        c.current_title ?? "",
        c.experience_years ?? "",
        clamp(c.overall_score ?? c.display_score ?? 0),
        c.skill_match ?? "",
        getEffectiveRoleAlignment(c),
        c.evidence_score ?? "",
        c.credibility_score ?? "",
        c.project_quality_score ?? "",
        c.experience_fit_score ?? "",
        c.confidence_level ?? "",
        rec?.label ?? "",
        (c.skills ?? []).join("; "),
        c.is_honeypot ? "Yes" : "No",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
    });

    const csv = [headers.map((h) => `"${h}"`).join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href     = url;
    link.download = "candidate_rankings.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const allRankings   = results?.rankings || [];
  const recMap = assignRecommendations(allRankings);

  const topCandidates  = allRankings.slice(0, 3);
  const shortlisted    = allRankings.slice(0, 30);

 
// ─── Role-aligned candidates using effective role alignment ──
const roleAlignedCandidates = allRankings.filter(c => {
  const effectiveScore = getEffectiveRoleAlignment(c);
  return effectiveScore >= 50;
});
const roleAlignedCount = roleAlignedCandidates.length;
const avgRoleMatch = roleAlignedCount > 0
  ? Math.round(roleAlignedCandidates.reduce((sum, c) => {
      const score = getEffectiveRoleAlignment(c);
      return sum + clamp(score);
    }, 0) / roleAlignedCount)
  : 0;


  // ─── Existing KPIs ─────────────────────────────────────────────────────────
const recommendedInterviews = allRankings.filter((c) => {
  const rec = recMap.get(c.candidate_id);
  return rec && (rec.label === "Strong Interview" || rec.label === "Interview" || rec.label === "Good Fit");
}).length;
  const rejectedCount = allRankings.filter((c) => {
    const rec = recMap.get(c.candidate_id);
    return rec && rec.label === "Not Recommended";
  }).length;
  const highCredCount = allRankings.filter((c) => safe(c.credibility_score, 100) >= 75 && !c.is_honeypot).length;
  const honeypotCount = allRankings.filter((c) => c.is_honeypot).length;
  const topSkill       = allRankings[0]?.skills?.[0] ?? "N/A";

  // ─── Distribution based on recommendations ─────────────────────────────
  const recLabels = ["Strong Interview", "Interview", "Good Fit", "Review Carefully", "Not Recommended"];
  const recColors = {
    "Strong Interview": "bg-emerald-500",
    "Interview": "bg-blue-500",
    "Good Fit": "bg-purple-500",
    "Review Carefully": "bg-amber-500",
    "Not Recommended": "bg-red-400",
  };
  const distribution = recLabels.map(label => {
    const count = allRankings.filter(c => {
      const rec = recMap.get(c.candidate_id);
      return rec && rec.label === label;
    }).length;
    return {
      label,
      color: recColors[label],
      count,
      pct: allRankings.length ? Math.round((count / allRankings.length) * 100) : 0,
    };
  });

  const strongInterviewCount = allRankings.filter((c) => {
    const rec = recMap.get(c.candidate_id);
    return rec && rec.label === "Strong Interview";
  }).length;
  const interviewCount = allRankings.filter((c) => {
    const rec = recMap.get(c.candidate_id);
    return rec && rec.label === "Interview";
  }).length;
  const goodFitCount = allRankings.filter((c) => {
    const rec = recMap.get(c.candidate_id);
    return rec && rec.label === "Good Fit";
  }).length;
  const reviewCount = allRankings.filter((c) => {
    const rec = recMap.get(c.candidate_id);
    return rec && rec.label === "Review Carefully";
  }).length;
  const notRecommendedCount = allRankings.filter((c) => {
    const rec = recMap.get(c.candidate_id);
    return rec && rec.label === "Not Recommended";
  }).length;

  const medals  = ["🥇", "🥈", "🥉"];
  const medalBg = [
    "bg-gradient-to-br from-amber-50 to-yellow-100 border-amber-200",
    "bg-gradient-to-br from-slate-50 to-gray-100 border-gray-200",
    "bg-gradient-to-br from-orange-50 to-amber-100 border-orange-200",
  ];

  if (!mounted) return null;

  const filteredList = shortlisted
    .filter((c) => c.name?.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => clamp(b[sortBy] ?? b.display_score) - clamp(a[sortBy] ?? a.display_score));

  const filteredAllList = allRankings
    .filter((c) => c.name?.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => clamp(b[sortBy] ?? b.display_score) - clamp(a[sortBy] ?? a.display_score));

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
            <MetricCard icon="📄" label="Resumes Analyzed"       value={allRankings.length || 0}    sub="This session"                   accent="blue"    />
            <MetricCard icon="✅" label="Shortlisted"             value={shortlisted.length || 0}    sub="Top candidates"                 accent="emerald" />
            <MetricCard
              icon="⚡"
              label="Average Role Match"
              value={`${avgRoleMatch}%`}
              sub={roleAlignedCount > 0 ? `Among ${roleAlignedCount} role‑aligned candidates` : "No role-aligned candidates"}
              accent="violet"
            />
           <MetricCard
  icon="🎯"
  label="Recommended Interviews"
  value={recommendedInterviews}
  sub="Strong + Interview + Good Fit"
  accent="amber"
/>
          </div>

          {/* ── Intelligence Quality Bar (UPDATED) ── */}
          {allRankings.length > 0 && (honeypotCount > 0 || highCredCount > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-lg px-5 py-4 flex items-center gap-3">
                <span className="text-2xl">🛡️</span>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">High Credibility</p>
                  <p className="text-xl font-black text-emerald-600">{highCredCount} <span className="text-sm font-normal text-gray-500">candidates</span></p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-lg px-5 py-4 flex items-center gap-3">
                <span className="text-2xl">🚩</span>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Suspicious Profiles</p>
                  <p className="text-xl font-black text-red-500">{honeypotCount} <span className="text-sm font-normal text-gray-500">flagged</span></p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-lg px-5 py-4 flex items-center gap-3">
                <span className="text-2xl">🎯</span>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Role-Aligned Candidates</p>
                  <p className="text-xl font-black text-blue-600">{roleAlignedCount} <span className="text-sm font-normal text-gray-500">/ {allRankings.length}</span></p>
                </div>
              </div>
            </div>
          )}

          {/* ── AI HIRING INSIGHTS ── */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-xl">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-xl">🧠</div>
                <div>
                  <h2 className="font-bold text-lg">AI Hiring Insights</h2>
                  <p className="text-slate-400 text-xs">Generated from evidence-based candidate analysis</p>
                </div>
              </div>
              <span className="text-xs bg-blue-500/20 border border-blue-400/30 text-blue-300 px-3 py-1 rounded-full">AI Generated</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { icon: "✓", label: "Total Candidates Analyzed", value: allRankings.length },
                { icon: "✓", label: "Strongest Skill Found",      value: topSkill },
                { icon: "✓", label: "Rejected Candidates",        value: rejectedCount },
                { icon: "✓", label: "Recommended Interviews",     value: recommendedInterviews },
                { icon: "✓", label: "Average Role Match",        value: `${avgRoleMatch}%` },
                { icon: "✓", label: "Top Candidate Score",        value: allRankings.length > 0 ? `${clamp(allRankings[0].overall_score)}%` : 0 },
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
                  const sc  = scoreColor(clamp(c.overall_score));
                  const rec = recMap.get(c.candidate_id) ?? hiringRecommendation(c.overall_score, c.credibility_score, c.is_honeypot, c.rank ?? (i + 1), c.percentile_rank ?? null, allRankings.length, c.evidence_score ?? null, c.project_quality_score ?? null, c.experience_fit_score ?? null, c.confidence_level ?? null);
                  return (
                    <div key={i} className={`rounded-2xl border p-5 ${medalBg[i]} relative overflow-hidden hover:shadow-md transition-all duration-200 hover:-translate-y-0.5`}>
                      {i === 0 && <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/10 rounded-full -translate-y-8 translate-x-8" />}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">{medals[i]}</span>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 text-sm truncate">{c.name ?? "Unknown"}</p>
                          <p className="text-xs text-gray-500">{c.experience_years ?? 0} yrs · {c.current_title || "Candidate"}</p>
                        </div>
                      </div>
                      <div className="flex items-end justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-600">Match Score</span>
                        <span className={`text-2xl font-black ${sc.text}`}>{clamp(c.overall_score)}%</span>
                      </div>
                      <Bar value={clamp(c.overall_score)} colorClass={sc.bar} delay={i * 150} height="h-2.5" />
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className={`text-xs font-bold ${sc.text}`}>{clamp(c.overall_score)}% Match</span>
                        <span className="text-gray-300 text-xs">|</span>
                        {(() => { const pct = computePercentile(c, allRankings); return pct !== null ? (
                          <><span className="text-xs font-semibold text-gray-600">{ordinal(pct)} Percentile</span><span className="text-gray-300 text-xs">|</span></>
                        ) : null; })()}
                        <span className="text-xs font-semibold text-gray-600">Rank #{c.rank ?? (i + 1)}/{allRankings.length}</span>
                      </div>
                      <div className="mt-3">
                        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${rec.cls}`}>
                          {rec.icon} {rec.label}
                        </span>
                      </div>
                      {c.primary_specialization && c.primary_specialization !== "general" && (
                        <div className="mt-2">
                          <SpecializationBadge
                            primary={c.primary_specialization}
                            secondary={c.secondary_specialization}
                            penalty={c.specialization_penalty}
                          />
                        </div>
                      )}
                      {c.skills?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
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
              <h2 className="font-bold text-gray-900 text-lg mb-1">Recommendation Distribution</h2>
              <p className="text-xs text-gray-700 mb-5">Candidate breakdown by hiring recommendation label</p>
              <div className="space-y-3">
                {distribution.map((d, idx) => (
                  <div key={d.label} className="flex items-center gap-3">
                    <div className="w-36 flex-shrink-0">
                      <p className="text-sm font-medium text-gray-700">{d.label}</p>
                      <p className="text-xs text-gray-700">{d.count} candidates</p>
                    </div>
                    <div className="flex-1">
                      <Bar value={d.pct} colorClass={d.color} delay={idx * 100} />
                    </div>
                    <div className="w-16 text-right flex-shrink-0">
                      <span className="text-sm font-bold text-gray-700">{d.pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── CANDIDATES SECTION ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-6">

            {/* Recruiter Summary Bar */}
            {allRankings.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-5 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700">
                <span className="font-bold text-slate-900">{allRankings.length} Applicants</span>
                <span className="text-slate-300">|</span>
                <span><span className="font-semibold text-slate-800">{shortlisted.length}</span> Shortlisted</span>
                <span className="text-slate-300">|</span>
                <span className="text-emerald-700"><span className="font-semibold">{strongInterviewCount}</span> Strong Interview</span>
                <span className="text-slate-300">|</span>
                <span className="text-blue-700"><span className="font-semibold">{interviewCount}</span> Interview</span>
                <span className="text-slate-300">|</span>
                <span className="text-purple-700"><span className="font-semibold">{goodFitCount}</span> Good Fit</span>
                <span className="text-slate-300">|</span>
                <span className="text-amber-700"><span className="font-semibold">{reviewCount}</span> Review Carefully</span>
                <span className="text-slate-300">|</span>
                <span className="text-red-600"><span className="font-semibold">{notRecommendedCount}</span> Not Recommended</span>
              </div>
            )}

            {/* Tab Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                <button
                  onClick={() => { setActiveTab("shortlisted"); setExpandedCandidate(null); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    activeTab === "shortlisted"
                      ? "bg-white text-slate-900 shadow-sm border border-gray-200"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  ⭐ Top 30 Shortlisted
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === "shortlisted" ? "bg-slate-900 text-white" : "bg-gray-300 text-gray-600"}`}>
                    {Math.min(30, allRankings.length)}
                  </span>
                </button>
                <button
                  onClick={() => { setActiveTab("all"); setExpandedCandidate(null); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    activeTab === "all"
                      ? "bg-white text-slate-900 shadow-sm border border-gray-200"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  👥 All Candidates
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === "all" ? "bg-slate-900 text-white" : "bg-gray-300 text-gray-600"}`}>
                    {allRankings.length}
                  </span>
                </button>
              </div>
              <div>
                <p className="text-xs text-gray-500">
                  {activeTab === "shortlisted"
                    ? "Ranked by evidence-based AI match score"
                    : "Complete applicant pool in descending rank order"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-all duration-200 shadow-lg"
                >
                  ⬇ Export CSV
                </button>
                <button
                  onClick={() => setShowFullList(!showFullList)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition-all duration-200 shadow-lg"
                >
                  {showFullList ? "Hide List ▲" : "View List ▼"}
                </button>
              </div>
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
                  <option value="display_score">Sort: Overall Score</option>
                  <option value="technical_match">Sort: Technical Match</option>
                  <option value="behavioral_fit">Sort: Behavioral Fit</option>
                  <option value="experience_match">Sort: Experience Match</option>
                  <option value="evidence_score">Sort: Evidence Score</option>
                  <option value="credibility_score">Sort: Credibility</option>
                  <option value="validated_skill_ratio">Sort: Validated Skill Ratio</option>
                  <option value="career_consistency_score">Sort: Career Consistency</option>
                  <option value="project_relevance_score">Sort: Project Relevance</option>
                  <option value="role_alignment_score">Sort: Role Alignment</option>
                  <option value="specialization_penalty">Sort: Specialization Fit</option>
                </select>
              </div>
            )}

            {showFullList && (
              <div className="space-y-2">
                {(activeTab === "shortlisted" ? filteredList : filteredAllList).length === 0 && (
                  <p className="text-center text-gray-700 py-8 text-sm">No candidates match your search.</p>
                )}
                {(activeTab === "shortlisted" ? filteredList : filteredAllList).map((c, idx) => {
                  const sc      = scoreColor(clamp(c.overall_score));
                  const isOpen  = expandedCandidate === idx;
                  const isSaved = savedCandidates.includes(c.name);
                  const rec     = recMap.get(c.candidate_id) ?? hiringRecommendation(c.overall_score, c.credibility_score, c.is_honeypot, c.rank ?? (idx + 1), c.percentile_rank ?? null, allRankings.length, c.evidence_score ?? null, c.project_quality_score ?? null, c.experience_fit_score ?? null, c.confidence_level ?? null);

                  const metrics = [
                    { label: "Technical Match",  value: clamp(c.technical_match),  color: scoreColor(clamp(c.technical_match)).bar  },
                    { label: "Behavioral Fit",   value: clamp(c.behavioral_fit),   color: scoreColor(clamp(c.behavioral_fit)).bar   },
                    { label: "Experience Fit",   value: clamp(c.experience_match), color: scoreColor(clamp(c.experience_match)).bar },
                    { label: "Project Relevance",value: clamp(c.project_relevance),color: scoreColor(clamp(c.project_relevance)).bar},
                  ];

                  const percentile     = computePercentile(c, allRankings);
                  const contextNotes   = buildRankingContextNote(c, allRankings);
                  const totalCandidates = allRankings.length;

                  return (
                    <div key={idx} className={`border rounded-2xl overflow-hidden transition-all duration-200 ${isOpen ? "border-blue-200 shadow-md" : "border-gray-100 hover:border-gray-200 hover:shadow-lg"}`}>
                      {/* ── row ── */}
                      <div
                        className={`flex items-center gap-3 p-4 cursor-pointer ${isOpen ? "bg-blue-50/50" : "hover:bg-gray-50"}`}
                        onClick={() => setExpandedCandidate(isOpen ? null : idx)}
                      >
                        <span className={`w-9 h-9 rounded-full ${isOpen ? "bg-blue-600" : "bg-slate-800"} text-white text-xs font-bold flex items-center justify-center flex-shrink-0 transition-colors`}>
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-gray-900 text-sm">{c.name ?? "Unknown"}</p>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${rec.cls}`}>{rec.icon} {rec.label}</span>
                            {c.is_honeypot && (
                              <span className="text-[10px] bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-medium">🚩 Flagged</span>
                            )}
                            {isSaved && (
                              <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">⭐ Saved</span>
                            )}
                            {c.primary_specialization && c.primary_specialization !== "general" && (
                              <SpecializationBadge
                                primary={c.primary_specialization}
                                secondary={c.secondary_specialization}
                                penalty={c.specialization_penalty}
                              />
                            )}
                          </div>
                          {rec.note && (
                            <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{rec.note}</p>
                          )}

                          {/* ── Score bar with 3-tier coloring ── */}
                          <div className="flex items-center gap-3 mt-2">
                            <Bar value={clamp(c.overall_score)} colorClass={sc.bar} delay={idx * 30} height="h-2" />
                            <span className={`text-sm font-black ${sc.text} flex-shrink-0 w-12 text-right`}>{clamp(c.overall_score)}%</span>
                          </div>

                          {/* ── Match | Percentile | Rank ── */}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className={`text-xs font-bold ${sc.text}`}>
                              {clamp(c.overall_score)}% Match
                            </span>
                            <span className="text-gray-300 text-xs">|</span>
                            {percentile !== null && (
                              <>
                                <span className="text-xs font-semibold text-gray-600">
                                  {ordinal(percentile)} Percentile
                                </span>
                                <span className="text-gray-300 text-xs">|</span>
                              </>
                            )}
                            <span className="text-xs font-semibold text-gray-600">
                              Rank #{c.rank ?? (idx + 1)}{totalCandidates ? `/${totalCandidates}` : ""}
                            </span>
                          </div>

                          {/* ── Mini trust indicators ── */}
                          {(c.evidence_score !== undefined || c.credibility_score !== undefined) && (
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              {c.evidence_score !== undefined && (
                                <span className="text-xs text-gray-500">Evidence <span className="font-semibold text-gray-700">{clamp(c.evidence_score)}%</span></span>
                              )}
                              {c.credibility_score !== undefined && (
                                <span className="text-xs text-gray-500">Credibility <span className="font-semibold text-gray-700">{clamp(c.credibility_score)}%</span></span>
                              )}
                              {c.validated_skill_ratio !== undefined && (
                                <span className="text-xs text-gray-500">Validated Skills <span className="font-semibold text-gray-700">{clamp(c.validated_skill_ratio)}%</span></span>
                              )}
                              {c.career_consistency_score !== undefined && (
                                <span className="text-xs text-gray-500">Consistency <span className="font-semibold text-gray-700">{clamp(c.career_consistency_score)}%</span></span>
                              )}
                              {c.confidence_level && (
                                <span className="text-xs text-gray-500">
                                  Confidence <span className={`font-bold ${
                                    c.confidence_level === "High"     ? "text-emerald-700" :
                                    c.confidence_level === "Moderate" ? "text-amber-700"   : "text-red-700"
                                  }`}>{c.confidence_level}</span>
                                </span>
                              )}
                            </div>
                          )}

                          {/* ── Contextual ranking explanation notes ── */}
                          {contextNotes.length > 0 && (
                            <div className="mt-2 space-y-0.5">
                              {contextNotes.map((note, ni) => (
                                <p key={ni} className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1 leading-snug">
                                  ℹ {note}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className={`text-gray-600 text-xs transition-transform duration-300 flex-shrink-0 ${isOpen ? "rotate-180" : ""}`}>▼</span>
                      </div>

                      {/* ── expanded panel ── */}
                      {isOpen && (
                        <div className="border-t border-blue-100 bg-white p-6 space-y-6">

                          {/* Score Breakdown */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Score Breakdown</h4>
                              <span className="text-[10px] text-gray-500 italic">Absolute job match scores</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {metrics.map((m, mi) => {
                                const mc = absoluteScoreColor(m.value);
                                return (
                                  <div key={m.label} className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-semibold text-gray-700">{m.label}</span>
                                      <span className={`text-base font-black ${mc.text}`}>{m.value}%</span>
                                    </div>
                                    <Bar value={m.value} colorClass={mc.bar} delay={mi * 80} />
                                  </div>
                                );
                              })}
                            </div>

                            <div className="mt-3 bg-slate-800 rounded-xl px-4 py-3 flex items-start gap-3">
  <span className="text-blue-300 text-sm flex-shrink-0 mt-0.5">ℹ</span>
  <div>
    <p className="text-xs font-bold text-white mb-0.5">Rank vs Match Score</p>
    <p className="text-xs text-slate-300 leading-snug">
      <span className="text-white font-semibold">{clamp(c.overall_score)}%</span> is this candidate's absolute job match score, calculated from technical fit, experience, projects, behavioral fit, and evidence quality.{" "}
      <span className="text-white font-semibold">Rank #{c.rank ?? (idx + 1)}{totalCandidates ? `/${totalCandidates}` : ""}</span>{" "}
      {percentile !== null && (
        <>and <span className="text-white font-semibold">{ordinal(percentile)} Percentile</span> represent this candidate's relative position among all applicants for this role. </>
      )}
      {(() => {
        const rankNum = c.rank ?? (idx + 1);
        if (rankNum === 1) {
          return "Rank #1 indicates they achieved the highest overall evaluation among all applicants.";
        } else {
          return `Rank #${rankNum} means ${rankNum - 1} candidate${rankNum - 1 > 1 ? 's' : ''} scored higher for this role.`;
        }
      })()}
    </p>
  </div>
</div>

                          </div>

                          {/* AI Confidence Card */}
                          <AIConfidenceCard candidate={c} />

                          {/* Recruiter Trust Panel */}
                          <RecruiterTrustPanel candidate={c} />

                          {/* Recruiter Intelligence Panel */}
                          <div>
                            <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3">Recruiter Intelligence</h4>
                            <RecruiterIntelPanel candidate={c} recMap={recMap} />
                          </div>

                          {/* Evidence Sources Card */}
                          <EvidenceSourcesCard candidate={c} />

                          {/* Impressive Project Evidence Card */}
                          <ImpressiveProjectCard candidate={c} />

                          {/* Matched Skills Analysis */}
                          <SkillsAnalysis candidate={c} />

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

         {/* ── COMING SOON – AI INTERVIEW PREDICTOR (toned down) ── */}
<div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white border border-slate-700 relative overflow-hidden">
  <div className="relative flex items-start gap-4">
    <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-400/20 flex items-center justify-center text-xl flex-shrink-0">📊</div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="font-bold text-base">AI Interview Predictor</h3>
        <span className="text-[10px] bg-blue-500/10 border border-blue-400/20 text-blue-300 px-2 py-0.5 rounded-full font-medium">Coming Soon</span>
      </div>
      <p className="text-slate-400 text-xs mt-1">Predicts interview success probability using deep candidate profile analysis, behavioral signals, and role-specific benchmarks.</p>
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
        
        {/* ─── AI CHAT WIDGET ─── */}
       <ChatWidget rankingId={results?.id} />
        </main>
      </div>

      
    </div>
  );
}
function ChatWidget({ rankingId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // NEW
  const [messages, setMessages] = useState([
    { role: "bot", content: "👋 Hi! I'm ForgeMate. Ask me anything about your candidates." }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [questionsLeft, setQuestionsLeft] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

 const sendMessage = async () => {
  if (!input.trim() || isLoading) return;
  if (!rankingId) {
    alert("No ranking found. Please run a ranking first.");
    return;
  }

  const userMessage = input.trim();
  setInput("");
  setMessages(prev => [...prev, { role: "user", content: userMessage }]);
  setIsLoading(true);

  try {
    console.log("Sending request to /api/chat-ranking");
    console.log("Ranking ID:", rankingId);
    console.log("Question:", userMessage);

    const response = await fetch("/api/chat-ranking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ranking_id: rankingId,
        question: userMessage
      })
    });

    console.log("Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response body:", errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log("Response data:", data);

    if (data.premium_required) {
      setMessages(prev => [...prev, {
        role: "bot",
        content: `🔒 ${data.message}`
      }]);
    } else {
      setQuestionsLeft(data.questions_left);
      setMessages(prev => [...prev, { role: "bot", content: data.answer }]);
      if (data.questions_left === 0) {
        setMessages(prev => [...prev, {
          role: "bot",
          content: "⚠️ You've used all your free questions. Upgrade to Premium to continue asking."
        }]);
      }
    }
  } catch (error) {
    console.error("Chat error:", error);
    setMessages(prev => [...prev, {
      role: "bot",
      content: `⚠️ Error: ${error.message || "Could not reach AI service. Please try again."}`
    }]);
  } finally {
    setIsLoading(false);
  }
};

  const quickActions = [
    { label: "Why #1?", text: "Why is the #1 candidate ranked highest?" },
    { label: "Compare top 2", text: "Compare the top 2 candidates" },
    { label: "Top strengths", text: "What are the top 3 strengths of the #1 candidate?" },
  ];

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-20 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-white text-2xl transition-all duration-300 ${
          isOpen ? "bg-red-500 hover:bg-red-600" : "bg-blue-600 hover:bg-blue-700"
        }`}
        aria-label="Chat with AI"
      >
        {isOpen ? "✕" : "🤖"}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div
          className={`fixed bottom-32 right-6 z-50 bg-white rounded-2xl border border-gray-200 shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
            isExpanded
              ? "w-[800px] max-w-[calc(100vw-3rem)] h-[80vh] max-h-[80vh]"
              : "w-96 max-w-[calc(100vw-2rem)] h-[500px] max-h-[60vh]"
          }`}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center gap-2 flex-shrink-0">
            <span className="text-white text-lg">🤖</span>
            <span className="text-white font-bold text-sm">ForgeMate AI</span>
            {questionsLeft !== null && (
              <span className="ml-auto text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">
                {questionsLeft} questions left
              </span>
            )}
            {/* ── EXPAND / COLLAPSE BUTTON ── */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="ml-2 text-white/70 hover:text-white transition-colors p-1 rounded hover:bg-white/10"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L20 20m0 0H9m11 0V9" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                </svg>
              )}
            </button>
          </div>

          {/* Messages */}
<div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
  {messages.map((msg, i) => (
    <div
      key={i}
      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
          msg.role === "user"
            ? "bg-blue-600 text-white rounded-br-none"
            : "bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm"
        }`}
      >
        {msg.role === "user" ? (
          // For user messages, keep the simple text (or you can still use BoldText if you like)
          msg.content
        ) : (
          // For bot messages, render markdown with tables
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              table: ({ node, ...props }) => (
                <div className="overflow-x-auto my-2">
                  <table className="min-w-full text-xs border-collapse border border-gray-200" {...props} />
                </div>
              ),
              thead: ({ node, ...props }) => (
                <thead className="bg-gray-50 border-b border-gray-200" {...props} />
              ),
              tbody: ({ node, ...props }) => (
                <tbody className="divide-y divide-gray-100" {...props} />
              ),
              th: ({ node, ...props }) => (
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700" {...props} />
              ),
              td: ({ node, ...props }) => (
                <td className="border border-gray-200 px-3 py-2 text-gray-700" {...props} />
              ),
              h1: ({ node, ...props }) => <h1 className="text-base font-bold mt-2 mb-1" {...props} />,
              h2: ({ node, ...props }) => <h2 className="text-sm font-bold mt-2 mb-1" {...props} />,
              h3: ({ node, ...props }) => <h3 className="text-sm font-semibold mt-1.5 mb-0.5" {...props} />,
              p: ({ node, ...props }) => <p className="mb-1.5 last:mb-0" {...props} />,
              ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-1.5 space-y-0.5" {...props} />,
              ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-1.5 space-y-0.5" {...props} />,
              li: ({ node, ...props }) => <li className="text-gray-700" {...props} />,
              strong: ({ node, ...props }) => <strong className="font-bold text-gray-900" {...props} />,
              em: ({ node, ...props }) => <em className="italic text-gray-600" {...props} />,
              hr: ({ node, ...props }) => <hr className="my-2 border-gray-200" {...props} />,
              blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-blue-400 pl-3 py-1 my-1 text-gray-600" {...props} />,
              code: ({ node, inline, ...props }) =>
                inline ? (
                  <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono" {...props} />
                ) : (
                  <code className="block bg-gray-100 p-2 rounded text-xs font-mono overflow-x-auto" {...props} />
                ),
            }}
          >
            {msg.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  ))}
  {isLoading && (
    <div className="flex justify-start">
      <div className="bg-white border border-gray-200 text-gray-500 rounded-xl rounded-bl-none px-4 py-2.5 text-sm shadow-sm flex items-center gap-1">
        <span className="animate-pulse">●</span>
        <span className="animate-pulse delay-75">●</span>
        <span className="animate-pulse delay-150">●</span>
      </div>
    </div>
  )}
  <div ref={messagesEndRef} />
</div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-1.5 px-3 py-2 bg-white border-t border-gray-100 flex-shrink-0">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => {
                  setInput(action.text);
                  setTimeout(() => {
                    const sendBtn = document.querySelector('.chat-send-btn');
                    if (sendBtn) sendBtn.click();
                  }, 100);
                }}
                className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-full transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 p-3 bg-white flex gap-2 flex-shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ask about candidates..."
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 text-gray-700 placeholder-gray-400"
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="chat-send-btn bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex-shrink-0"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
export default function Results() {
  return (
    <Suspense fallback={null}>
      <ResultsInner />
    </Suspense>
  );
}