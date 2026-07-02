"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Home as HomeIcon,
  FlaskConical,
  BarChart3,
  History,
  Settings,
  Bot,
  User,
  Moon,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [history, setHistory] = useState([]);
  const [shake, setShake] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { label: "Dashboard", href: "/", icon: HomeIcon },
    { label: "New Ranking", href: "/new-rankings", icon: FlaskConical },
    { label: "Results", href: "/results", icon: BarChart3 },
    { label: "History", href: "/history", icon: History },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  const loadHistory = async () => {
    try {
      const response = await fetch(`${API_BASE}/rankings`);
      const data = await response.json();
      console.log("History:", data);
      console.log("Count:", data.length);
      setHistory(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleDarkModeClick = () => {
    setShake(true);
    setShowComingSoon(true);
    setTimeout(() => setShake(false), 450);
    setTimeout(() => setShowComingSoon(false), 2800);
  };

  return (
    <main className="min-h-screen flex bg-white">
      {/* Sidebar */}
      <aside
        className={`sticky top-0 h-screen overflow-hidden bg-slate-900 text-white shadow-xl transition-all duration-300 flex-shrink-0 ${
          sidebarOpen ? "w-72" : "w-0"
        }`}
      >
        <div className="flex min-h-screen w-72 flex-col p-5 overflow-hidden">
          <div className="mb-8">
            <h1 className="text-3xl font-bold font-playwrite">ForgeMatch</h1>
            <p className="mt-1 text-sm text-slate-400 font-playwrite">
              Recruiting Platform
            </p>
          </div>

          <nav className="flex flex-col mt-2 gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link key={item.href} href={item.href}>
                  <button
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition duration-300 ${
                      isActive
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30"
                        : "text-slate-300 hover:bg-slate-900 hover:text-white"
                    }`}
                  >
                    <Icon size={20} />
                    {item.label}
                  </button>
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-500/10 p-2 text-blue-400">
                <Bot size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-white">
                  AI Interview Predictor
                </p>
                <p className="text-xs text-slate-400">Coming Soon</p>
              </div>
            </div>
          </div>

          {/* Recent Rankings Section - REMOVED */}

          <div className="flex-1" />

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600">
                <User size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Recruiter</p>
                <p className="text-xs text-slate-400">Talent Acquisition</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleDarkModeClick}
            className={`mt-3 flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white ${
              shake ? "animate-nono" : ""
            }`}
          >
            <span className="flex items-center gap-3">
              <Moon size={18} />
              Dark Mode
            </span>
            <span className="h-5 w-9 rounded-full bg-slate-700 p-0.5">
              <span className="block h-4 w-4 rounded-full bg-white" />
            </span>
          </button>

          {showComingSoon && (
            <p className="animate-popIn mt-2 text-center text-xs font-medium text-blue-400">
              🚧 easy there — dark mode is landing in{" "}
              <span className="font-bold">v2</span>. patience 😌
            </p>
          )}
        </div>
      </aside>

      <div className="flex flex-col flex-1">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex flex-col gap-1 p-3 w-fit bg-slate-900 rounded-br-xl"
        >
          <div
            className={`w-5 h-0.5 bg-white transition-all duration-300 ${
              sidebarOpen ? "rotate-45 translate-y-1.5" : ""
            }`}
          />
          <div
            className={`w-5 h-0.5 bg-white transition-all duration-300 ${
              sidebarOpen ? "opacity-0" : ""
            }`}
          />
          <div
            className={`w-5 h-0.5 bg-white transition-all duration-300 ${
              sidebarOpen ? "-rotate-45 -translate-y-1.5" : ""
            }`}
          />
        </button>
      </div>
    </main>
  );
}
