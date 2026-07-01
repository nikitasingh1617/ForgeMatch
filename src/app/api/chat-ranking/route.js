// src/app/api/chat-ranking/route.js
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/chat-ranking`,  
      {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json(
      { answer: "⚠️ Could not connect to AI service. Please try again later." },
      { status: 500 }
    );
  }
}