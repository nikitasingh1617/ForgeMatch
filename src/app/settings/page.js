"use client";
 import Sidebar from "../components/Sidebar";
 import { useState } from "react";
  import { usePathname } from "next/navigation";
 import Link from "next/link";
 import Image from "next/image";
 export default function Settings() {
  const pathname = usePathname();
  const [selectedModel, setSelectedModel] = useState("");
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

    <label className="flex items-center gap-2">
      <input type="checkbox" />
      AI Model Status Notifications
    </label>
  </div>

  <p className="text-green-600 mt-4">
  🟢 Notifications Enabled
</p>
</div>

        <div className="bg-white rounded-xl text-gray-900 border mt-6 border-gray-200 p-4 shadow-sm hover:shadow-md hover:border-orange-400 transition cursor-pointer">
            <h2 className="text-2xl font-semibold mb-2">
                AI Model
            </h2>
            <div className="space-y-3">
                <label className="flex gap-2">
                    <input
                      type="radio"
                      name="model"
                      value="Gemini 2.5"
                      onChange={(e) => setSelectedModel(e.target.value)}
                       />
                         Gemini 2.5
                </label>
                <label className="flex gap-2">
                    <input
                      type="radio"
                      name="model"
                      value="ChatGPT"
                      onChange={(e) => setSelectedModel(e.target.value)}
                       />
                        ChatGPT
                </label>
                <label className="flex gap-2">
                    <input
                      type="radio"
                      name="model"
                      value="Claude"
                      onChange={(e) => setSelectedModel(e.target.value)}
                       />
                        Claude
                </label>
                <label className="flex gap-2">
                    <input
                      type="radio"
                      name="model"
                      value="Local"
                      onChange={(e) => setSelectedModel(e.target.value)}
                       />
                        Local Model
                </label>
            </div>
            </div>

            {selectedModel && (
                                <div className="bg-white rounded-xl border border-gray-200 text-gray-900 p-4 mt-6 shadow-sm hover:shadow-md hover:border-orange-400 transition cursor-pointer">
                               <h2 className="text-2xl font-semibold mb-4">
                               AI Configuration
                            </h2>

                              <div className="space-y-2">
                               <p><strong>Model:</strong> {selectedModel}</p>
                                    <p><strong>Status:</strong> 🟢 Connected</p>
                         <p><strong>Reasoning Mode:</strong> Enabled</p>
                       <p><strong>Resume Explanation:</strong> Enabled</p>
                   </div>
                   </div>
                )}
                
                   
         


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




     
        
        
        
  