
"use client";
 import {useState, useEffect} from "react";
 import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  HomeIcon,
  FlaskConical,
  History,
  Settings,
  X}
  from "lucide-react";
  import {useRouter } from "next/navigation";


export default function NewRankings() { 

   const [loading, setLoading] = useState(false);
   const [loadingMessage, setLoadingMessage] = useState("");

  const router = useRouter();

  useEffect(() => {
    if (!loading) return;

    const messages = [
      "📄 Reading resumes...",
      "🧠 Extracting skills...",
      "🎯 Matching job requirements...",
      "⚙️ Calculating scores...",
      "🏆 Ranking candidates..."
    ];

    let index = 0;

    const interval = setInterval(() => {
      index = (index + 1) % messages.length;
      setLoadingMessage(messages[index]);
    }, 2000);

    return () => clearInterval(interval);
  }, [loading]);


  const handleRanking = async() => {
    try{

      console.log("BUTTON CLICKED !")
      
      if (!jobDomain.trim()) {
        alert("Please enter Job Domain");
        return;
      }

      if (!jobDescription.trim()) {
        alert("Please enter Job Description");
        return;
      }


      if (files.length === 0) {
        alert("Please upload at least one resume");
        return;
      }
      const formData = new FormData();

      files.forEach((file) => {
        formData.append("resumes", file);
      });
      formData.append("job_domain",jobDomain)
      formData.append("job_description",jobDescription)
      
      console.log("Sending request...");
      console.log("Files:", files.length);
      console.log("Job Domain:", jobDomain);
      console.log("Job Description:", jobDescription);
      
      setLoading(true);
      setLoadingMessage("Uploading resumes...")
      const response = await
      fetch("http://127.0.0.1:8000/rank-resumes", {method: "POST", body: formData,});

      console.log("Response status:", response.status);

      if (!response.ok) {
        throw new Error("Backend error");
      }

      const data= await response.json();
      console.log("STEP 1");

      localStorage.setItem(
        "rankingResults",
        JSON.stringify(data)
      );
      console.log("STEP 2")
       
      setLoading(false);
       router.push("/results");
       console.log("STEP 3")
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();
  const [files, setFiles]= useState([]);
  const [jobDomain, setJobDomain] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  

  const removeFile = (indexToRemove) => {
    setFiles(files.filter((_, index) => index !== indexToRemove));
  };

  const handleFileChange = (e) => {// done
    const newFiles = Array.from(e.target.files);

    setFiles((preFiles) => {
      const allFiles = [...preFiles, ...newFiles];

      console.log(allFiles);

      return allFiles.filter(
        (file, index, self) =>
          index === self.findIndex((f) => f.name === file.name)
      );
    });
  };      

  

  

  return (
        <main className="min-h-screen flex bg-white">


         {/* Sidebar */}
      <aside className={`bg-slate-900 text-white p-4 shadow-lg transition-all duration-300 overflow-hidden flex-shrink-0 ${sidebarOpen ? "w-64" : "w-0"}`}>
        <div className="w-64 p-6 font-playwrite">
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

        <div className="bg-slate-50 p-10 px-12 rounded-3xl shadow-md w-full">

          <h1 className="text-4xl font-bold text-center text-gray-950 font-playwrite">
            Job Details
          </h1>

          <p className="text-gray-700 text-center mt-2 font-playwrite">
            Enter the job requirements below
          </p>

          <h2 className="mt-6 text-gray-950 font-semibold">
            Job Domain
          </h2>

          <input
            type="text" 
            value={jobDomain}
            onChange={(e) => setJobDomain(e.target.value)}
            placeholder="e.g. Machine Learning Engineer"
            className="w-full p-3 text-gray-800 border rounded-lg mt-2 focus:ring-2 focus:ring-blue-400 outline-none"
          />

          <h2 className="mt-6 text-gray-950 font-semibold">
            Job Description
          </h2>

          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job description here..."
            className="w-full p-3 text-gray-800 border rounded-lg mt-2 h-40 focus:ring-2 focus:ring-blue-400 outline-none"
          ></textarea>

          <h2 className="mt-6 text-gray-950 font-semibold">
            Upload Resumes
          </h2>
          

          <input
            id="resume-upload"
            type="file"
            accept=".pdf,.doc,.docx"
            multiple
            onChange={handleFileChange}
            className="hidden"/>

            <label 
            htmlFor="resume-upload"
            className="block w-full border border-gray-900 rounded-lg p-3 mt-2 text-gray-500 cursor-pointer">
              Select Files</label>
             

            

            

            {files.length > 0 && (
  <div className="mt-4 p-4 bg-gray-50 text-green-600 font-semibold rounded-lg border">
    <div className="flex justify-between items-center mb-2">
  <p className="font-semibold text-green-800">
    📄 {files.length} files selected
  </p>

  <button
    onClick={() => setFiles([])}
    className="text-red-600 text-sm font-semibold hover:text-red-800"
  >
    Clear All
  </button>
</div>
  

    <div className="max-h-40 overflow-y-auto">
      {files.map((file, index) => (
  <div key={index} className="flex items-center gap-2">
    <button
      onClick={() => removeFile(index)}
      className="text-red-500"
    >
      <X size={16}/>
    </button>

    <span>{file.name}</span>
  </div>
))}
      </div>
    </div>
  )}

   
    
    
  


            <button
            onClick={handleRanking}
            disabled={loading}
              className="w-full mt-8 bg-orange-500 hover:bg-orange-600 hover:scale-105 transition duration-300 text-white font-bold py-3 rounded-xl">
              {loading? "Ranking Candidates...":"Rank Candidates"}
          
            </button>
            

            {loading && (
              <p className="mt-2 text-gray-600">
                {loadingMessage}
              </p>
            )}
            
        </div>
        
        
      </main>
  );

}
    
