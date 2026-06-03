"use client";

import Sidebar from "../components/Sidebar";
import { useEffect, useState } from "react";

export default function Results() {
  const [results, setResults] = useState(null);
  const [expandedCandidate, setExpandedCandidate] = useState(null);
  const [showFullList, setShowFullList] = useState(false);

  useEffect(() => {
    const data = localStorage.getItem("rankingResults");
    if (data) {
      setResults(JSON.parse(data));
    }
  }, []);

  const topCandidates = results?.rankings?.slice(0, 3) || [];
  const shortlistedCandidates = results?.rankings?.slice(0, 30) || [];

  const handleViewResume = (candidate) => {
  if (candidate.resume_url) {
    const url = encodeURI(candidate.resume_url);
    window.open(url, "_blank");
  } else {
    alert("No resume available for this candidate.");
  }
};

const handleDownloadResume = async (candidate) => {
  if (candidate.resume_url) {
    const link = document.createElement("a");
    link.href = candidate.resume_url;
    link.download = `${candidate.name}_resume.pdf`;
    link.click();
  } else {
    alert("No resume available for this candidate.");
  }
};

  return (
    <main className="min-h-screen flex bg-gray-50">
      <Sidebar />

      <div className="flex flex-col flex-1">

        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Ranking Results</h1>
          <p className="text-gray-500 mt-1">AI-powered candidate scoring</p>
        </div>

        <div className="p-8 flex flex-col gap-8">

          {/* Top 3 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">🏆 Top Candidates</h2>
            <div className="flex flex-col gap-4">
              {topCandidates.map((candidate, index) => (
                <div key={index} className={`flex items-center justify-between p-4 rounded-xl ${
                  index === 0 ? "bg-yellow-50 border border-yellow-200" :
                  index === 1 ? "bg-gray-50 border border-gray-200" :
                  "bg-orange-50 border border-orange-200"
                }`}>
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">
                      {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                    </span>
                    <div>
                      <p className="font-bold text-gray-900">{candidate.name}</p>
                      <p className="text-sm text-gray-500">Overall Score</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${candidate.overall_score}%` }}
                      />
                    </div>
                    <span className="font-bold text-green-600 w-12 text-right">
                      {candidate.overall_score}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Full Shortlist */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Top 30 Shortlisted Candidates</h2>
              <button
                onClick={() => setShowFullList(!showFullList)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition"
              >
                {showFullList ? "Hide Full List ▲" : "View Full List ▼"}
              </button>
            </div>

            {showFullList && (
              <div className="flex flex-col gap-3">
                {shortlistedCandidates.map((candidate, index) => (
                  <div key={index} className="border border-gray-100 rounded-xl overflow-hidden">

                    {/* Row */}
                    <div className="flex items-center justify-between p-4 hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </span>
                        <p className="font-semibold text-gray-900">{candidate.name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-green-600 font-bold">{candidate.overall_score}%</span>
                        <button
                          onClick={() => setExpandedCandidate(expandedCandidate === index ? null : index)}
                          className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-100 transition"
                        >
                          {expandedCandidate === index ? "Hide ▲" : "View More ▼"}
                        </button>
                      </div>
                    </div>

                    {/* Expanded */}
                    {expandedCandidate === index && (
                      <div className="border-t border-gray-100 p-4 bg-gray-50 flex flex-col gap-4">
                        <div className="grid grid-cols-3 gap-4">
                          {[
                            { label: "Technical Match", value: candidate.technical_match },
                            { label: "Behavioral Fit", value: candidate.behavioral_fit },
                            { label: "Experience Match", value: candidate.experience_match },
                          ].map((item) => (
                            <div key={item.label} className="bg-white rounded-lg p-3 border border-gray-100">
                              <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                              <p className="font-bold text-gray-900">{item.value}%</p>
                              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                                <div
                                  className="bg-blue-500 h-1.5 rounded-full"
                                  style={{ width: `${item.value}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-100">
                          {candidate.reason}
                        </p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleViewResume(candidate)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                          >
                            View Resume
                          </button>
                          <button
                            onClick={() => handleDownloadResume(candidate)}
                            className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition"
                          >
                            Download Resume
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}

          

      

    