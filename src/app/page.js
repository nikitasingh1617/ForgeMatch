"use client";
 import {useState} from "react";
 import { usePathname } from "next/navigation";
 import Link from "next/link";
 import Image from "next/image";
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
      <aside className={`bg-slate-900 text-white p-4 shadow-lg transition-all duration-300 overflow-hidden flex-shrink-0S ${sidebarOpen ? "w-64" : "w-0"}`}>
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
    
           <h3 className="mt-8 text-gray-400 text-sm">
           Recent Rankings
           </h3>

           <div className="flex flex-col gap-2 mt-3">

            <button className="text-left p-2 rounded-lg hover:bg-slate-800">
              ML Engineer
            </button>

            <button className="text-left p-2 rounded-lg hover:bg-slate-800">
              Frontend Developer
            </button>

            <button className="text-left p-2 rounded-lg hover:bg-slate-800">
              Data Scientist
            </button>
           </div>

        
        </nav>
        </div>
      </aside>


      {/* Main Content */}
      <div className="relative flex-1">
      <div className="flex flex-col flex-1">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="flex flex-col gap-1 p-3 w-fit bg-slate-900 rounded-br-xl">
      <div className={`w-5 h-0,5 bg-white transition=all duration-300 ${sidebarOpen ? "rotate-45 translate-y-1.5" : ""}`} />
        <div className={`w-5 h-0.5 bg-white transition-all duration-300 ${sidebarOpen ? "opacity-0" : ""}`} />
        <div className={`w-5 h-0.5 bg-white transition-all duration-300 ${sidebarOpen ? "-rotate-45 -translate-y-1.5" : ""}`} />
      </button>
      </div>
      

      <div className="flex flex-row flex-1 items-start gap-8 p-8">

        <div className="flex flex-col">
        
        <h1 className="text-5xl font-bold text-gray-950 font-playwrite">
          Welcome to <br /> ForgeMatch!
        </h1>

        <p className="text-gray-600 mt-6 font-playwrite">
          AI-Powered <br /> Candidate Ranking System
        </p>
        
        <Link href="/new-rankings">
          <button className="mt-6 px-8 py-4 font-semibold bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition duration-300">
            + New Ranking
          </button>
        </Link>

             <div className="absolute top-6 right-6 flex items-center gap-2">
              <span className="text-sm text-gray-500 mt-1">Built with ❤️ by</span>
  <Image
    src="/elite-forge-logo.jpeg"
    alt="Elite Forge"
    width={90}
    height={30}
  />
  

</div>
        </div>
      </div>    

        
      

      <div className="flex flex-col md:flex-row gap-6 p-8 py-12">
        
        <div className="bg-white border border-gray-300 p-8 mt-10 rounded-xl shadow-sm hover:shadow-md hover:border-orange-400 transition cursor-pointer w-full">
          <div className="flex justify-between items-center">
            <h2 className="text-gray-950">
              Total Rankings
            </h2>
            <p className="text-2xl font-bold text-gray-950">10</p>
          </div>
        </div>

        <div className="bg-white border border-gray-300 p-8 mt-10 rounded-xl shadow-sm hover:shadow-md hover:border-orange-400 transition cursor-pointer w-full">
          <div className="flex justify-between items-center">
            <h2 className="text-gray-950">Resumes Processed</h2>
            <p className="text-2xl font-bold text-gray-950">50</p>
          </div>
        </div>

        <div className="bg-white border border-gray-300 p-8 mt-10 rounded-xl shadow-sm hover:shadow-md hover:border-orange-400 transition cursor-pointer w-full">
          <div className="flex justify-between items-center">
            <h2 className="text-gray-950">Candidates Ranked</h2>
            <p className="text-2xl font-bold text-gray-950">490</p>
          </div>
        </div>
      </div>
      </div>

     
    </main>
    );
} 
