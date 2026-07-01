"use client";
import Sidebar from "../components/Sidebar";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  FileText,
  Upload,
  Sparkles,
  X,
  Check,
  ChevronRight,
  File,
  AlertCircle,
  ArrowRight,
  Brain,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// How often (ms) to poll /rank-status/{id} while a ranking is processing
const POLL_INTERVAL_MS = 3000;

const STEPS = [
  { id: 1, icon: Briefcase, label: "Job Domain", desc: "What role are you hiring for?" },
  { id: 2, icon: FileText, label: "Job Description", desc: "Paste the full requirements" },
  { id: 3, icon: Upload, label: "Upload Resumes", desc: "Upload Candidate Profiles" },
  { id: 4, icon: Sparkles, label: "Run AI Ranking", desc: "Let AI find the best fit" },
];

const STAGES = [
  "Parsing Job Description",
  "Extracting Candidate Skills",
  "Analyzing Experience",
  "Matching Technical Requirements",
  "Ranking Candidates",
];

/* ── Step indicator ────────────────────────────────────────────── */
function StepBar({ current, canAdvance, onStep }) {
  return (
    <div className="flex items-center gap-0 mb-10">
      {STEPS.map((s, i) => {
        const done = current > s.id;
        const active = current === s.id;
        return (
          <div key={s.id} className="flex items-center flex-1 last:flex-none">
            <button
              onClick={() => done && onStep(s.id)}
              className={`relative flex flex-col items-center gap-2 group ${
                done ? "cursor-pointer" : "cursor-default"
              }`}
            >
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg
                  ${done ? "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/30" : ""}
                  ${active ? "ring-4 ring-offset-2 ring-offset-white ring-blue-500 shadow-blue-500/30" : ""}
                  ${!done && !active ? "bg-gray-100 border-2 border-gray-200" : ""}
                `}
                style={
                  active
                    ? { background: "linear-gradient(135deg, #3B82F6, #7C3AED)" }
                    : done
                    ? {}
                    : {}
                }
              >
                {done ? (
                  <Check size={18} className="text-white" />
                ) : (
                  <s.icon
                    size={16}
                    className={active ? "text-white" : "text-gray-400"}
                  />
                )}
              </div>
              <span
                className={`hidden sm:block text-[11px] font-semibold tracking-wide whitespace-nowrap transition-colors duration-200 ${
                  active
                    ? "text-blue-600"
                    : done
                    ? "text-emerald-600"
                    : "text-gray-400"
                }`}
              >
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div
                className="flex-1 h-0.5 mx-2 transition-all duration-500"
                style={{
                  background: done
                    ? "linear-gradient(90deg, #10B981, #3B82F6)"
                    : "#e5e7eb",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── File card ─────────────────────────────────────────────────── */
function FileCard({ file, onRemove }) {
  const size =
    file.size < 1024 * 1024
      ? `${(file.size / 1024).toFixed(0)} KB`
      : `${(file.size / 1024 / 1024).toFixed(1)} MB`;
  return (
    <div className="group flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 bg-blue-50/50 border border-blue-100/50 hover:border-blue-300/70 hover:shadow-md hover:shadow-blue-100/50">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-blue-500 to-blue-600 shadow-md shadow-blue-500/20">
        <File size={14} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{file.name}</p>
        <p className="text-[10px] mt-0.5 text-gray-400">{size}</p>
      </div>
      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-sm shadow-emerald-500/30">
        <Check size={11} className="text-white" />
      </div>
      <button
        onClick={onRemove}
        className="w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 hover:bg-red-100 text-gray-400 hover:text-red-500 hover:scale-110 flex-shrink-0"
      >
        <X size={12} />
      </button>
    </div>
  );
}

/* ─── Loading Modal ────────────────────────────────────────────────
   NOTE: `visible` controls whether it shows at all.
   `done` tells it the real backend job has actually finished — until
   then it keeps looping through the stages instead of stopping, since
   we no longer know the exact real duration up front (large batches
   can take minutes). This avoids the modal freezing on "Ranking
   Candidates" for a long time while work is still happening. */
function LoadingModal({ visible, done }) {
  const [stage, setStage] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!visible) {
      setStage(0);
      setProgress(0);
      return;
    }
    if (done) {
      setStage(STAGES.length - 1);
      setProgress(100);
      return;
    }
    const interval = setInterval(() => {
      setStage((s) => {
        const next = (s + 1) % STAGES.length; // loop while waiting for real completion
        setProgress(Math.round(((next + 1) / STAGES.length) * 100));
        return next;
      });
    }, 2200);
    return () => clearInterval(interval);
  }, [visible, done]);

  if (!visible) return null;

  const currentStage = STAGES[stage] || STAGES[0];
  const isComplete = done;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md transition-opacity duration-300">
      <div className="w-full max-w-md mx-4 rounded-2xl bg-white shadow-2xl p-7 animate-[fadeIn_0.3s_ease-out] border border-gray-100/50">
        {/* Header */}
        <div className="flex items-center gap-4 mb-5">
          <div className="relative flex-shrink-0">
            <div
              className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg ${
                isComplete
                  ? "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/30"
                  : "bg-gradient-to-br from-blue-500 to-purple-600 animate-pulse shadow-blue-500/30"
              }`}
            >
              {isComplete ? (
                <Check size={26} className="text-white" />
              ) : (
                <Sparkles size={26} className="text-white animate-spin-slow" />
              )}
            </div>
            {!isComplete && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white animate-ping" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">
              {isComplete ? "🎉 Analysis Complete!" : "AI is evaluating..."}
            </h2>
            <p className="text-sm text-gray-500 font-medium">
              {isComplete
                ? "All candidates ranked successfully"
                : "This can take a few minutes for large batches — feel free to keep this tab open"}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-600">
              {currentStage}
            </span>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
              {progress}%
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden bg-gray-100">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #3B82F6, #7C3AED)",
                boxShadow: "0 0 20px rgba(59,130,246,0.3)",
              }}
            />
          </div>
        </div>

        {/* Stages list */}
        <div className="space-y-2">
          {STAGES.map((s, i) => {
            const stageDone = isComplete || i < stage;
            const active = !isComplete && i === stage;

            return (
              <div key={s} className="flex items-center gap-3 p-1.5 rounded-lg transition-all duration-300 hover:bg-gray-50/50">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                    stageDone
                      ? "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/30"
                      : active
                      ? "bg-gradient-to-br from-blue-500 to-purple-600 ring-4 ring-blue-300/30 ring-offset-2 shadow-blue-500/30"
                      : "bg-gray-200"
                  }`}
                >
                  {stageDone ? (
                    <Check size={14} className="text-white" />
                  ) : active ? (
                    <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-semibold transition-colors duration-300 ${
                      stageDone
                        ? "text-gray-500"
                        : active
                        ? "text-gray-900"
                        : "text-gray-400"
                    }`}
                  >
                    {s}
                  </p>
                  {active && (
                    <p className="text-[10px] text-blue-600 font-medium animate-pulse">
                      Processing...
                    </p>
                  )}
                  {stageDone && (
                    <p className="text-[10px] text-emerald-600 font-semibold">✓ Complete</p>
                  )}
                </div>
                <span
                  className={`text-[10px] font-bold px-3 py-1 rounded-full flex-shrink-0 transition-all duration-300 ${
                    stageDone
                      ? "bg-emerald-50 text-emerald-600"
                      : active
                      ? "bg-blue-50 text-blue-600 animate-pulse"
                      : "bg-gray-50 text-gray-400"
                  }`}
                >
                  {stageDone ? "Done" : active ? "Run" : "Wait"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400 font-medium">
          <span>Processing {STAGES.length} stages</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-600">Live</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────────── */
export default function NewRankings() {
  const [step, setStep] = useState(1);
  const [jobDomain, setJobDomain] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rankingDone, setRankingDone] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const router = useRouter();
  const pollRef = useRef(null);

  // Clean up any in-flight polling if the user navigates away mid-ranking
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const canNext = () => {
    if (step === 1) return jobDomain.trim().length > 0;
    if (step === 2) return jobDescription.trim().length > 0;
    if (step === 3) return files.length > 0;
    return true;
  };

  const next = () => {
    if (canNext() && step < 4) setStep(step + 1);
  };
  const back = () => {
    if (step > 1) setStep(step - 1);
  };

  const addFiles = (newFiles) => {
    const arr = Array.from(newFiles);
    setFiles((prev) => {
      const merged = [...prev, ...arr];
      return merged.filter(
        (f, i, self) => i === self.findIndex((g) => g.name === f.name)
      );
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const handleRanking = async () => {
    setError("");
    if (!jobDomain.trim()) {
      setError("Please enter a job domain.");
      return;
    }
    if (!jobDescription.trim()) {
      setError("Please enter a job description.");
      return;
    }
    if (files.length === 0) {
      setError("Please upload at least one resume.");
      return;
    }

    const formData = new FormData();
    files.forEach((f) => formData.append("candidate_files", f));
    formData.append("job_domain", jobDomain);
    formData.append("job_description", jobDescription);

    setLoading(true);
    setRankingDone(false);

    try {
      // 1) Kick off the ranking job — returns almost instantly with an id
      const startRes = await fetch(`${API_BASE}/rank-start`, {
        method: "POST",
        body: formData,
      });

      if (!startRes.ok) {
        throw new Error("Failed to start ranking job");
      }

      const { ranking_id } = await startRes.json();

      // 2) Poll for completion instead of waiting on one long request
      //    (avoids Hugging Face's ~60s gateway timeout on large batches)
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_BASE}/rank-status/${ranking_id}`);

          if (!statusRes.ok) {
            // Transient network hiccup — keep polling rather than failing immediately
            return;
          }

          const statusData = await statusRes.json();

          if (statusData.status === "done") {
            clearInterval(pollRef.current);
            pollRef.current = null;
            setRankingDone(true);
            localStorage.setItem("rankingResults", JSON.stringify(statusData.result));
            // Small delay so the user sees the "Complete!" state briefly
            setTimeout(() => {
              setLoading(false);
              router.push(`/results?from=${ranking_id}`);
            }, 900);
          } else if (statusData.status === "error") {
            clearInterval(pollRef.current);
            pollRef.current = null;
            setLoading(false);
            setError(statusData.error || "Ranking failed. Please try again.");
          }
          // else status === "processing" -> keep polling silently
        } catch (err) {
          // Network blip while polling — don't kill the whole flow on one failed poll
          console.warn("Poll attempt failed, will retry:", err);
        }
      }, POLL_INTERVAL_MS);

    } catch (err) {
      setLoading(false);
      setError(
        "Something went wrong starting the ranking. Make sure the backend is running."
      );
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <LoadingModal visible={loading} done={rankingDone} />

      <main className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Topbar */}
        <header className="sticky top-0 z-30 px-8 py-5 flex items-center justify-between bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/25">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-gray-900">New AI Ranking</h1>
              <p className="text-xs font-medium text-emerald-600">
                Step {step} of 4
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200/50">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-700">Ready</span>
          </div>
        </header>

        <div className="flex-1 p-8 page-enter max-w-3xl mx-auto w-full">
          {/* Step bar */}
          <StepBar current={step} canAdvance={canNext()} onStep={setStep} />

          {/* Card */}
          <div className="rounded-3xl p-8 bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300">
            {/* Step title */}
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/25">
                {(() => {
                  const S = STEPS[step - 1];
                  return <S.icon size={20} className="text-white" />;
                })()}
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                  {STEPS[step - 1].label}
                </h2>
                <p className="text-sm mt-0.5 text-gray-500 font-medium">
                  {STEPS[step - 1].desc}
                </p>
              </div>
            </div>

            {/* ── Step 1: Job Domain ── */}
            {step === 1 && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-3 text-gray-500">
                  Job Domain / Role Title
                </label>
                <input
                  type="text"
                  value={jobDomain}
                  onChange={(e) => setJobDomain(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && next()}
                  placeholder="e.g. Senior Machine Learning Engineer"
                  className="w-full rounded-xl px-5 py-4 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all duration-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-gray-50 border-2 border-gray-200 hover:border-gray-300"
                />
                <div className="mt-5 flex flex-wrap gap-2">
                  {[
                    "Frontend Developer",
                    "Backend Engineer",
                    "Data Scientist",
                    "Product Manager",
                    "UX Designer",
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => setJobDomain(s)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 bg-gray-50 border-2 border-gray-200 text-gray-600 hover:scale-105"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 2: Job Description ── */}
            {step === 2 && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-3 text-gray-500">
                  Full Job Description
                </label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the complete job description including responsibilities, required skills, and qualifications..."
                  rows={9}
                  className="w-full rounded-xl px-5 py-4 text-sm text-gray-900 placeholder-gray-400 outline-none resize-none transition-all duration-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-gray-50 border-2 border-gray-200 hover:border-gray-300"
                />
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-gray-400 font-medium">
                    {jobDescription.length} characters
                  </p>
                  <p className="text-xs text-blue-600 font-semibold">
                    More detail = better AI matching
                  </p>
                </div>
              </div>
            )}

            {/* ── Step 3: Upload Resumes ── */}
            {step === 3 && (
              <div>
                {/* Drop zone */}
                <div
                  className={`upload-zone rounded-2xl p-10 text-center cursor-pointer mb-5 transition-all duration-200 ${
                    dragOver
                      ? "border-blue-400 bg-blue-50/50 shadow-lg shadow-blue-100/50 scale-[1.02]"
                      : "border-2 border-dashed border-gray-300 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/30"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                >
                  <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-100 border-2 border-blue-200/50 shadow-inner">
                    <Upload size={28} className="text-blue-500" />
                  </div>
                  <p className="text-base font-semibold text-gray-900">
                    Drop resumes here, or{" "}
                    <span className="text-blue-500 hover:underline">browse</span>
                  </p>
                  <p className="text-sm mt-2 text-gray-400 font-medium">
                    Upload Candidate profiles in JSON, DOCX OR PDF
                  </p>
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,.jsonl,.pdf,.docx,.doc"
                  multiple
                  onChange={(e) => addFiles(e.target.files)}
                  className="hidden"
                />

                {files.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-bold text-gray-900">
                        {files.length} file{files.length !== 1 ? "s" : ""} selected
                      </p>
                      <button
                        onClick={() => setFiles([])}
                        className="text-sm font-semibold text-red-400 hover:text-red-500 transition-colors"
                      >
                        Clear all
                      </button>
                    </div>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {files.map((f, i) => (
                        <FileCard
                          key={i}
                          file={f}
                          onRemove={() =>
                            setFiles(files.filter((_, j) => j !== i))
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 4: Run ── */}
            {step === 4 && (
              <div className="space-y-5">
                {[
                  {
                    label: "Job Domain",
                    value: jobDomain,
                    icon: Briefcase,
                    color: "from-blue-500 to-blue-600",
                  },
                  {
                    label: "Job Description",
                    value: `${jobDescription.slice(0, 80)}...`,
                    icon: FileText,
                    color: "from-indigo-500 to-indigo-600",
                  },
                  {
                    label: "Resumes Uploaded",
                    value: `${files.length} file${files.length !== 1 ? "s" : ""}`,
                    icon: Upload,
                    color: "from-purple-500 to-purple-600",
                  },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div
                    key={label}
                    className="group flex items-center gap-4 rounded-xl px-5 py-4 bg-gray-50 border border-gray-200 hover:border-blue-200/80 hover:shadow-md transition-all duration-200"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${color} shadow-md`}>
                      <Icon size={18} className="text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                        {label}
                      </p>
                      <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
                    </div>
                    <Check
                      size={18}
                      className="text-emerald-500 flex-shrink-0"
                    />
                  </div>
                ))}

                <div className="rounded-xl p-5 mt-3 bg-blue-50/80 border border-blue-100/80 shadow-inner">
                  <div className="flex items-start gap-3">
                    <Brain size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm font-medium text-gray-700 leading-relaxed">
                      AI will analyze each candidate against your job requirements, extract skills,
                      evaluate experience, and produce a ranked list with detailed reasoning.
                      For large batches (500+ resumes) this can take a few minutes — you can
                      leave this tab open and check the History page later if you navigate away.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-5 flex items-start gap-3 rounded-xl px-5 py-4 bg-red-50 border-2 border-red-200 shadow-sm">
                <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-semibold text-red-600">{error}</p>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 mt-8">
              {step > 1 && (
                <button
                  onClick={back}
                  className="px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200 hover:bg-gray-100 bg-gray-50 border-2 border-gray-200 text-gray-600 hover:border-gray-300"
                >
                  Back
                </button>
              )}

              {step < 4 ? (
                <button
                  onClick={next}
                  disabled={!canNext()}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white transition-all duration-200 ${
                    canNext()
                      ? "bg-gradient-to-r from-blue-500 to-purple-600 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98]"
                      : "opacity-40 cursor-not-allowed bg-gray-300"
                  }`}
                >
                  Continue <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={handleRanking}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-3 py-3.5 rounded-xl text-sm font-bold text-white transition-all duration-200 bg-gradient-to-r from-blue-500 to-purple-600 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <Sparkles size={18} />
                  {loading ? "Ranking in progress..." : "Run AI Ranking"}
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}