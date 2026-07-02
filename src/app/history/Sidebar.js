
"use client";
 import {useState, useEffect} from "react";
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
Moon,}
  from "lucide-react";


const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";



export default function Home() {
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [history, setHistory] = useState([]);
  const pathname = usePathname();
  const router = useRouter();
  const navItems = [
    { label: "Dashboard", href: "/", icon: HomeIcon},
    { label: "New Ranking", href: "/new-rankings", icon: FlaskConical},
    { label: "Results", href: "/results", icon: BarChart3 },
    { label: "History", href: "/history", icon: History},
    { label: "Settings", href: "/settings", icon: Settings},];

   
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

  return (
        <main className="min-h-screen flex bg-white">

         {/* Sidebar */}
      <aside className={`sticky top-0 h-screen overflow-y-auto bg-slate-900 text-white shadow-xl transition-all duration-300  flex-shrink-0 ${sidebarOpen ? "w-72" : "w-0"}`}>
        <div className="max-h-72 overflow-y-auto flex min-h-screen  w-72 flex-col p-5">

          <div className= "mb-8">
        <h1 className="text-3xl font-bold font-playwrite">
        ForgeMatch
        </h1>
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
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30":"text-slate-300 hover:bg-slate-900 hover:text-white"

                }`}>

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

              <p className="text-xs text-slate-400">
                Coming Soon
              </p>

              
              
          </div>
            
          </div>
          </div>

          {pathname === "/" && (
            <div className="mt-6 py-12">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                Recent Rankings
              </h3>

              <div className="flex flex-col gap-2">
                
                {history.length === 0? (
                  <p className="rounded-xl bg-slate-900/70 p-3 text-xs text-slate-500">
                    No rankings yet
                    </p>
                ):(
                history.slice(0,5).map((item) => (
                  
                  <button
                    key={item.id}
                    type="button"
                    onClick={async () => {
                      try {
                        console.log("Clicked item:", item);
console.log("ID:", item.id);

const url = `${API_BASE}/rankings/${item.id}`;
console.log("Fetching:", url);

const response = await fetch(url);

console.log("Status:", response.status);
console.log("OK:", response.ok);
                     

                      if (!response.ok) {
                        throw new Error("Failed to load page");
                      }

                      const data = await response.json();

                      localStorage.setItem(
                        "rankingResults",
                        JSON.stringify(data)
                      );

                      router.push("/results");
                    } catch (error) {
                      console.error(error);
                      alert("Could not load this ranking.");
                    }
                  }}
                    className="w-full text-left"
                  
                  >
                    <div className="p-3 rounded-lg bg-slate-900/70 transition hover:bg-slate-800">
                      <p className="truncate text-white text-sm font-semibold">
                        {item.job_domain}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        
                        {new Date(item.created_at).toLocaleString("en-IN", {
                                   day: "numeric",
                                   month: "short",
                                   year: "numeric",
                                   hour: "numeric",
                                   minute: "2-digit",
                                     })}
                                  </p>
                    </div>
                  </button>
                ))
              )}
              </div>
            </div>
          )}


         <div className="flex-1" />

         <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600">
              <User size={20} />
            </div>

            <div>
              <p className="text-sm font-bold text-white">
                Recruiter
              </p>
              <p className="text-xs text-slate-400">
                Talent Acquisition
              </p>
            </div>
          </div>
         </div>

         <button className="mt-3 flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white">
          <span className="flex items-center gap-3">
            <Moon size={18} />
            Dark Mode
          </span>
         
          <span className="h-5 w-9 rounded-full bg-slate-700 p-0.5">
            <span className="block h-4 w-4 rounded-full bg-white"/>
          </span>
         </button>
         <p className="flex text-xs front-gray-100 mx-3 mt-3">
           Seed funding: ₹0
          </p>
          <p className="flex text-xs front-gray-100 mx-3 mt-0">
           Dark mode progress: 12%
          </p>
         


          </div>
         
       
       </aside>
          
      
        <div className="flex flex-col flex-1">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="flex flex-col gap-1 p-3 w-fit bg-slate-900 rounded-br-xl">
      <div className={`w-5 h-0,5 bg-white transition=all duration-300 ${sidebarOpen ? "rotate-45 translate-y-1.5" : ""}`} />
        <div className={`w-5 h-0.5 bg-white transition-all duration-300 ${sidebarOpen ? "opacity-0" : ""}`} />
        <div className={`w-5 h-0.5 bg-white transition-all duration-300 ${sidebarOpen ? "-rotate-45 -translate-y-1.5" : ""}`} />
      </button>
      </div>
      </main>
  );
}

