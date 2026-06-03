"use client";
 import Sidebar from "../components/Sidebar";
  import { usePathname } from "next/navigation";
 import Link from "next/link";
 import Image from "next/image";
 export default function History() {
  const pathname = usePathname();

  return (

    <div className="flex">
      <Sidebar />
      <main className="flex-1">

    
    <div className="p-12 py-21 bg-slate-50">
      <h1 className="text-4xl font-playwrite text-gray-950">
        Ranking History
      </h1>

      <p className="text-gray-600 mt-2">
        View your previous candidate rankings
      </p>

      <div className="mt-8 space-y-4">
        <div className="border border-gray-300 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-orange-400 transition cursor-pointer">
          <h2 className="font-semibold text-black text-lg">
            ML Engineer
          </h2>
          <p className="text-gray-500">
            52 resumes • June 1, 2026
          </p>
        </div>

        <div className="border border-gray-300 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-orange-400 transition cursor-pointer">
          <h2 className="font-semibold text-black text-lg">
            Frontend Developer
          </h2>
          <p className="text-gray-500">
            18 resumes • May 31, 2026
          </p>
        </div>

        <div className="border border-gray-300 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-orange-400 transition cursor-pointer">
          <h2 className="font-semibold text-black text-lg">
            Data Scientist
          </h2>
          <p className="text-gray-500">
            41 resumes • May 30, 2026
          </p>
        </div>
      </div>
    </div>
    </main>
    </div>
  );
}