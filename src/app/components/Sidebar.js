
"use client";
 import {useState} from "react";
 import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home as HomeIcon,
  FlaskConical,
  History,
  Settings}
  from "lucide-react";



export default function Home() { 
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();
  return (
        <main className="min-h-screen flex bg-white">

         {/* Sidebar */}
      <aside className={`bg-slate-900 text-white p-4 shadow-lg transition-all duration-300 overflow-hidden flex-shrink-0 ${sidebarOpen ? "w-64" : "w-0"}`}>
        <div className="w-64 p-6">
        <h1 className="text-3xl font-bold mb-10 font-playwrite">
        ForgeMatch
        </h1>


        <nav className="flex flex-col gap-3">

             <Link href="/">
          <button className={`flex items-center gap-3 text-left p-3 rounded-xl hover:bg-slate-800 transition duration-300 ${pathname === "/" ? "bg-blue-500 text-white" : "text-white hover:bg-slate-800"}`}>
          <HomeIcon size={20}/>
          Dashboard
          </button>
          </Link>

          <Link href="/new-rankings">
          <button className={`flex items-center gap-3 text-left p-3 rounded-xl hover:bg-slate-800 transition duration-300 ${pathname === "/new-rankings" ? "bg-blue-500 text-white" : "text-white hover:bg-slate-800"}`}>
          <FlaskConical size={20}/>
          New Rankings
          </button>
          </Link>

          
          <Link href="/history">
          <button className={`flex items-center gap-3 text-left p-3 rounded-xl hover:bg-slate-800 transition duration-300 ${pathname === "/history" ? "bg-blue-500 text-white" : "text-white hover:bg-slate-800"}`}>
          <History size={20}/>
            History
          </button>
          </Link>

          <Link href="/settings">
          <button className={`flex items-center gap-3 text-left p-3 rounded-xl hover:bg-slate-800 transition duration-300 ${pathname === "/settings" ? "bg-blue-500 text-white" : "text-white hover:bg-slate-800"}`}>
          <Settings size={20}/>
          Settings
          </button>
          </Link> 
          </nav>
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

