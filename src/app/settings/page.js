"use client";

import Sidebar from "../components/Sidebar";
import { useState } from "react";
import {
  Settings as SettingsIcon,
  User,
  Brain,
  Wrench,
  Info,
  Save,
  Shield,
  Zap,
  Search,
  Database,
  Lock,
  FileDown,
  LayoutDashboard,
  Sparkles,
} from "lucide-react";

const tabs = [
  { id: "general", label: "General" },
  { id: "account", label: "Account" },
  { id: "engine", label: "Ranking Engine" },
  { id: "tools", label: "Tools & Frameworks" },
  { id: "about", label: "About ForgeMatch" },
];

function Card({ children, className = "" }) {
  return (
    <div
      className={`rounded-[22px] border border-gray-200 bg-[#fbfdff] p-6 transition duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-[0_16px_35px_rgba(15,23,42,0.07)] ${className}`}
    >
      {children}
    </div>
  );
}

function Header({ icon, title, desc }) {
  return (
    <div className="mb-7 flex items-center gap-4">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white">
        {icon}
      </div>
      <div>
        <h2 className="mb-1 text-[26px] font-extrabold text-gray-950">
          {title}
        </h2>
        <p className="text-sm leading-7 text-slate-500">{desc}</p>
      </div>
    </div>
  );
}

function IconBox({ icon }) {
  return (
    <div className="mb-4 grid h-[42px] w-[42px] place-items-center rounded-[14px] bg-indigo-50 text-indigo-600">
      {icon}
    </div>
  );
}

function CheckSetting({ label, checked, onChange }) {
  return (
    <label className="mt-4 flex items-center gap-3 text-sm font-bold text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="accent-blue-600"
      />
      {label}
    </label>
  );
}

function LockedSetting({ label }) {
  return (
    <label className="mt-4 flex cursor-not-allowed items-center gap-3 text-sm font-bold text-slate-700 opacity-80">
      <input type="checkbox" checked disabled readOnly className="accent-blue-600" />
      <span>{label}</span>
      <span className="ml-auto flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-black text-indigo-600">
        <Lock size={12} />
        Required
      </span>
    </label>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between gap-5 border-b border-slate-100 py-4 last:border-b-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-right text-sm font-extrabold text-gray-950">
        {value}
      </span>
    </div>
  );
}

function Weight({ label, value, onChange }) {
  return (
    <div className="mt-6">
      <div className="mb-2 flex justify-between text-sm font-extrabold text-gray-900">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <input
        type="range"
        defaultValue={value}
        onInput={onChange}
        className="w-full cursor-pointer accent-blue-600"
      />
    </div>
  );
}

function ToolCard({ title, type, desc, tags }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-[#fbfdff] p-6 transition duration-200 before:absolute before:right-0 before:top-0 before:h-28 before:w-28 before:rounded-full before:bg-blue-100 before:blur-2xl before:content-[''] hover:-translate-y-1 hover:border-indigo-300 hover:shadow-[0_18px_38px_rgba(15,23,42,0.08)]">
      <div className="relative z-10">
        <div className="mb-4 flex justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-gray-950">{title}</h3>
            <span className="mt-2 inline-block rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-extrabold text-indigo-600">
              {type}
            </span>
          </div>

          <div className="mt-1 h-3 w-3 flex-shrink-0 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 shadow-[0_0_18px_rgba(37,99,235,0.5)]" />
        </div>

        <p className="text-sm leading-7 text-slate-500">{desc}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-700"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState("general");
  const [saved, setSaved] = useState(false);
  const [futureMsg, setFutureMsg] = useState(false);

  const [compactLayout, setCompactLayout] = useState(true);
  const [smoothAnimations, setSmoothAnimations] = useState(true);
  const [rememberJD, setRememberJD] = useState(true);
  const [rememberDomain, setRememberDomain] = useState(true);
  const [csvShortcut, setCsvShortcut] = useState(true);

  function showSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  function futureFeature() {
    setFutureMsg(true);
    setTimeout(() => setFutureMsg(false), 2600);
  }

  return (
    <div className="flex min-h-screen bg-[#f6f8fb] text-gray-950">
      <Sidebar />

      <main className="flex-1 px-8 py-10 lg:px-16">
        <div className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div>
            <h1 className="mb-2 text-[42px] font-black tracking-[-1.5px] text-gray-950">
              Settings
            </h1>
            <p className="text-sm leading-7 text-slate-500">
              Manage ForgeMatch controls, ranking engine details, tools, and system identity.
            </p>
          </div>

          <div className="h-max w-fit rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm font-extrabold text-green-700">
            ● System Healthy
          </div>
        </div>

        <nav className="mb-7 flex flex-wrap gap-3 rounded-[22px] border border-gray-200 bg-white p-2.5 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-[15px] px-4 py-3 text-sm font-extrabold transition duration-200 ${
                activeTab === tab.id
                  ? "bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-[0_12px_24px_rgba(37,99,235,0.25)]"
                  : "text-slate-500 hover:bg-slate-100 hover:text-gray-950"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <section className="min-h-[500px] rounded-[28px] border border-gray-200 bg-white p-8 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          {activeTab === "general" && (
            <div>
              <Header
                icon={<SettingsIcon size={24} />}
                title="General"
                desc="Simple preferences that can be safely controlled from the frontend."
              />

              <div className="grid gap-[18px] lg:grid-cols-2">
                <Card>
                  <IconBox icon={<LayoutDashboard size={20} />} />
                  <strong className="mb-2 block text-base font-extrabold">
                    Display Preferences
                  </strong>

                  <CheckSetting
                    label="Compact Layout"
                    checked={compactLayout}
                    onChange={() => setCompactLayout(!compactLayout)}
                  />

                  <CheckSetting
                    label="Smooth Animations"
                    checked={smoothAnimations}
                    onChange={() => setSmoothAnimations(!smoothAnimations)}
                  />
                </Card>

                <Card>
                  <IconBox icon={<Shield size={20} />} />
                  <strong className="mb-2 block text-base font-extrabold">
                    Explainability Features
                  </strong>

                  <LockedSetting label="Show Confidence Score" />
                  <LockedSetting label="Show Candidate Explanation" />
                  <LockedSetting label="Show Ranking Breakdown" />

                  <div className="mt-[18px] rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm font-semibold leading-7 text-orange-700">
                    These options are locked because they are part of ForgeMatch’s explainable ranking output.
                  </div>
                </Card>

                <Card>
                  <IconBox icon={<Database size={20} />} />
                  <strong className="mb-2 block text-base font-extrabold">
                    Workspace Memory
                  </strong>

                  <CheckSetting
                    label="Remember Last Job Description"
                    checked={rememberJD}
                    onChange={() => setRememberJD(!rememberJD)}
                  />

                  <CheckSetting
                    label="Remember Selected Job Domain"
                    checked={rememberDomain}
                    onChange={() => setRememberDomain(!rememberDomain)}
                  />
                </Card>

                <Card>
                  <IconBox icon={<FileDown size={20} />} />
                  <strong className="mb-2 block text-base font-extrabold">
                    Export Preference
                  </strong>

                  <CheckSetting
                    label="Enable CSV Export Shortcut"
                    checked={csvShortcut}
                    onChange={() => setCsvShortcut(!csvShortcut)}
                  />
                </Card>
              </div>

              <button
                onClick={showSaved}
                className="mt-7 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 px-6 py-4 text-sm font-extrabold text-white shadow-[0_14px_30px_rgba(249,115,22,0.3)] transition hover:-translate-y-1"
              >
                <span className="inline-flex items-center gap-2">
                  <Save size={18} />
                  Save Settings
                </span>
              </button>

              {saved && (
                <div className="mt-[18px] rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-extrabold text-green-700">
                  ✅ Settings saved successfully.
                </div>
              )}
            </div>
          )}

          {activeTab === "account" && (
            <div>
              <Header
                icon={<User size={24} />}
                title="Account"
                desc="Team and administrator information."
              />

              <Card>
                <InfoRow label="Team" value="Elite Forge" />
                <InfoRow label="Role" value="Administrator" />
                <InfoRow label="Project" value="ForgeMatch" />
                <InfoRow label="Access Level" value="Full Control" />
              </Card>
            </div>
          )}

          {activeTab === "engine" && (
            <div>
              <Header
                icon={<Brain size={24} />}
                title="Ranking Engine"
                desc="Semantic retrieval plus hybrid ranking."
              />

              <div className="grid gap-[18px] lg:grid-cols-3">
                <Card>
                  <IconBox icon={<Sparkles size={20} />} />
                  <strong className="mb-2 block text-base font-extrabold">
                    Sentence Transformers
                  </strong>
                  <p className="text-sm leading-7 text-slate-500">
                    Creates semantic vector representations for job descriptions and candidate profiles.
                  </p>
                </Card>

                <Card>
                  <IconBox icon={<Zap size={20} />} />
                  <strong className="mb-2 block text-base font-extrabold">
                    MiniLM
                  </strong>
                  <p className="text-sm leading-7 text-slate-500">
                    Lightweight transformer model used for efficient semantic embeddings.
                  </p>
                </Card>

                <Card>
                  <IconBox icon={<Search size={20} />} />
                  <strong className="mb-2 block text-base font-extrabold">
                    FAISS Vector Search
                  </strong>
                  <p className="text-sm leading-7 text-slate-500">
                    Retrieves relevant candidate profiles before deeper hybrid ranking.
                  </p>
                </Card>
              </div>

              <Card className="mt-[18px]">
                <strong className="mb-2 block text-base font-extrabold">
                  Reference Weight System
                </strong>
                <p className="text-sm leading-7 text-slate-500">
                  Shown only as a future customization concept.
                </p>

                <div className="mt-[18px] rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm font-semibold leading-7 text-orange-700">
                  ⚠️ These weights are for reference only and are <b>NOT USED</b> in current ranking.
                </div>

                <Weight label="Skills Weight" value="45" onChange={futureFeature} />
                <Weight label="Experience Weight" value="35" onChange={futureFeature} />
                <Weight label="Projects Weight" value="20" onChange={futureFeature} />

                {futureMsg && (
                  <div className="mt-[18px] rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-extrabold text-green-700">
                    🚧 Future Feature: custom ranking weights are not active yet.
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeTab === "tools" && (
            <div>
              <Header
                icon={<Wrench size={24} />}
                title="Tools & Frameworks"
                desc="How each technology is used inside ForgeMatch."
              />

              <div className="grid gap-[18px] lg:grid-cols-2">
                <ToolCard
                  title="Next.js"
                  type="Frontend Framework"
                  desc="Used for app routing, dashboard pages, settings screens, and frontend structure."
                  tags={["Routing", "Pages", "UI"]}
                />

                <ToolCard
                  title="React"
                  type="UI Library"
                  desc="Used to build reusable components like cards, tabs, forms, result views, and controls."
                  tags={["Components", "State", "Tabs"]}
                />

                <ToolCard
                  title="Tailwind CSS"
                  type="Styling System"
                  desc="Used for responsive layout, spacing, shadows, rounded cards, and clean dashboard styling."
                  tags={["Layout", "Responsive", "Design"]}
                />

                <ToolCard
                  title="FastAPI"
                  type="Backend API"
                  desc="Handles resume uploads, job description processing, ranking requests, and result delivery."
                  tags={["API", "Uploads", "Ranking"]}
                />

                <ToolCard
                  title="Python"
                  type="Core Logic"
                  desc="Powers parsing, embeddings, candidate processing, ranking signals, and backend workflows."
                  tags={["Parsing", "Logic", "Processing"]}
                />

                <ToolCard
                  title="FAISS"
                  type="Vector Search"
                  desc="Retrieves the most relevant candidate profiles from embedding space before hybrid ranking."
                  tags={["Search", "Retrieval", "Vectors"]}
                />

                <ToolCard
                  title="Sentence Transformers"
                  type="Embedding Model"
                  desc="Creates semantic embeddings from job descriptions and candidate profiles."
                  tags={["Embeddings", "Semantic", "Matching"]}
                />

                <ToolCard
                  title="MiniLM"
                  type="Lightweight Transformer"
                  desc="Efficient transformer model used for fast semantic embeddings."
                  tags={["Fast", "Compact", "Vectors"]}
                />
              </div>
            </div>
          )}

          {activeTab === "about" && (
            <div>
              <Header
                icon={<Info size={24} />}
                title="About ForgeMatch"
                desc="Fast, explainable candidate shortlisting."
              />

              <Card>
                <InfoRow label="Version" value="1.0.0 Beta" />
                <InfoRow label="Built By" value="Elite Forge" />
                <InfoRow label="Purpose" value="Resume Ranking + Candidate Matching" />
                <InfoRow label="Core" value="Semantic Embeddings + Hybrid Ranking" />
              </Card>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
