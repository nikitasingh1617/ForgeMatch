"use client";
import Sidebar from "./components/Sidebar";
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
import { useEffect } from "react";


export default function Home() { 
  
  const pathname = usePathname();

  return (
     <div className="flex">
          <Sidebar />
     <main className="w-full  bg-white min-h-screen py-12">

  
      


      {/* Main Content */}
      <div className="relative flex-1">
      
     
      

      <div className="flex flex-row items-start gap-8 p-8">

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
    </div>
    );
} 
