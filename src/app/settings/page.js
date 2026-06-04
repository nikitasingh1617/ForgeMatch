"use client";
 import Sidebar from "../components/Sidebar";
 import { useState } from "react";
  import { usePathname } from "next/navigation";
 import Link from "next/link";
 import Image from "next/image";
 export default function Settings() {
  const pathname = usePathname();
  const [showMessage, setShowMessage]= useState(false);

  return (

    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-10 bg-white px-20">
        <h1 className="text-4xl font-bold text-gray-950 mb-2">
            Settings
        </h1>
        <p className= "text-gray-500 mb-8">
            Manage your ForgeMatch preferences
        </p> 

        

        <div className="grid gap-6">
        <div className="bg-white text-gray-900 rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md hover:border-orange-400 transition cursor-pointer">
            <h2 className="text-2xl font-semibold mb-2">
                Account Information
            </h2>
            <div className="space-y-2">
                <p><strong>Team: </strong>Elite Forge</p>
                <p><strong>Role: </strong>Administrator</p>
                <p><strong>Project: </strong>ForgeMatch</p>
            </div>
        </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 text-gray-900 p-4 mt-6 shadow-sm hover:shadow-md hover:border-orange-400 transition cursor-pointer">
  <h2 className="text-2xl font-semibold mb-4">
    Notifications
  </h2>

  <div className="space-y-3">
    <label className="flex items-center gap-2">
      <input type="checkbox" defaultChecked />
      Ranking Complete Alerts
    </label>

    <label className="flex items-center gap-2">
      <input type="checkbox" defaultChecked />
      Candidate Match Updates
    </label>

    <label className="flex items-center gap-2">
      <input type="checkbox" />
      Weekly Performance Reports
    </label>
    </div>


</div>

        <div className="bg-white rounded-xl text-gray-700 border mt-4 border-gray-200 p-4 shadow-sm hover:shadow-md hover:border-orange-400 transition cursor-pointer">
            <h2 className="text-2xl font-semibold mb-2 mt-0">
                AI Model
            </h2>
            <h2 className="text-xs font-medium mb-4">
              1 June 2026 - 4 June 2026
            </h2>
            <h2 className="text-xs font-semibold mb-4">
              Cause of death:
            </h2>
            <h2 className="text-xs font-medium mb-4">
              submission_spec.docx
            </h2>
            
            
            </div>

            
                   
         


            <div className="bg-white rounded-xl border border-gray-200 p-4 mt-6 text-gray-900 shadow-sm hover:shadow-md hover:border-orange-400 transition cursor-pointer">
                <h2 className="text-2xl font-semibold mb-4">
                    Ranking Preferences
                </h2>

                <div className="space-y-6 mb-6">
                    <div>
                        <p>Skills Weight</p>
                        <input type="range"
                        defaultValue="40"
                        className="w-full"
                        />
                    </div>

                    <div><p>Experience Weight</p>
                    <input type="range"
                    defaultValue="35"
                    className="w-full"
                    />
                    </div>

                    <div><p>Education Weight</p>
                    <input type="range"
                    defaultValue="25"
                    className="w-full"
                    />
                    </div>
                </div>
                </div>

                <div className ="bg-white rounded-xl border border-gray-200 p-4 mt-6 text-gray-900 shadow-sm hover:shadow-md hover:border-orange-400 transition cursor-pointer ">
                    <h2 className="text-2xl font-semibold mb-4">
                        About ForgeMatch
                    </h2>
                    <p className="text-gray-600">Version 1.0.0-beta</p>
                    <p className="text-gray-600">AI-Powered Candidate Ranking System</p>

                    <p className="mt-4 font-medium">Built with ❤️ by Elite Forge</p>
                </div>

             <button
  onClick={() => {
    setShowMessage(true);
       setTimeout(() => {
      setShowMessage(false);
    }, 2000);
  }}
    className="bg-orange-500 text-white px-4 py-2 rounded-xl mt-6 hover:bg-orange-600 transition">
    Save Settings
    </button>


    {showMessage && (
  <p className="text-green-600 mt-3 font-medium">
    ✅ Settings saved successfully!
  </p>
)}

  

  
                       
                

            </main>
            </div>
  );
}




     
        
        
        
  