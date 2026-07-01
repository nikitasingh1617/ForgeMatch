import os
from dotenv import load_dotenv
from openai import OpenAI
import traceback

from core.prompts import build_recruiter_chat_prompt

# ── Force load .env from the Backend folder ──
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(backend_dir, ".env")
load_dotenv(dotenv_path=env_path, override=True)

# Debug
api_key = os.getenv("OPENROUTER_API_KEY")
if api_key:
    print(f"🔑 ai_chat loaded key: {api_key[:15]}...")
else:
    print("❌ No API key found – using mock only.")

client = OpenAI(
    api_key=api_key,
    base_url="https://openrouter.ai/api/v1",
    default_headers={
        # OpenRouter uses these for attribution / rate-limit tiering.
        # Without them some accounts get deprioritized or rejected.
        "HTTP-Referer": os.getenv("OPENROUTER_SITE_URL", "https://forgematch.app"),
        "X-Title": "ForgeMatch",
    },
)

# List of models to try (in order of preference)
# IMPORTANT: OpenRouter's free-tier catalog rotates frequently (multiple
# slugs we tried, including mistral-7b-instruct:free and gemma-2-9b-it:free,
# returned 404 within the same week). Hardcoding individual :free slugs is
# fragile. "openrouter/free" is OpenRouter's own auto-router that always
# points at whatever free model is currently live — use that as the
# primary choice instead of guessing slugs. Verify anytime at
# https://openrouter.ai/models?max_price=0
MODELS = [
    "openrouter/free",
    "meta-llama/llama-3.1-8b-instruct:free",  # fallback if router is down
]


def ask_recruiter_ai(ranking_data, question):
    if not api_key:
        print("⚠️ No API key, using mock response")
        return generate_mock_response(ranking_data, question)

    prompt = build_recruiter_chat_prompt(ranking_data, question)

    # Try each model until one works
    last_error = None
    for model in MODELS:
        try:
            response = client.chat.completions.create(
                model=model,
                max_tokens=1000,  # lowered from 1500 — your account showed a
                                   # 402 "can only afford 1447" error on the
                                   # previous value; 1000 leaves headroom
                messages=[{"role": "user", "content": prompt}]
            )
            print(f"✅ AI call succeeded with model: {model}")
            return response.choices[0].message.content
        except Exception as e:
            print(f"❌ Model {model} failed: {e}")
            traceback.print_exc()  # full stack trace + real cause (auth/rate-limit/bad slug/etc.)
            last_error = e
            # Continue to next model

    # If all models fail, fallback to mock
    print("❌ All AI models failed. Falling back to mock.")
    print("Last error:", repr(last_error))
    return generate_mock_response(ranking_data, question)


def generate_mock_response(ranking_data, question):
    """Smart fallback that uses the ranking data."""
    rankings = ranking_data.get("rankings", [])
    if not rankings:
        return "No ranking data found. Please run a ranking first."

    # Try to parse the question for a specific rank
    question_lower = question.lower()
    target_rank = 1
    # Simple rank detection
    for word in question_lower.split():
        if word.startswith("#") and word[1:].isdigit():
            target_rank = int(word[1:])
            break
        if word.isdigit() and int(word) <= len(rankings):
            target_rank = int(word)
            break

    if target_rank > len(rankings):
        target_rank = 1

    target = rankings[target_rank - 1]
    lines = [
        f"🔍 **ForgeMate AI (Demo Mode)**\n",
        f"Top candidate: **{target.get('name', 'Unknown')}** (Rank #{target.get('rank', '-')})",
        f"Match Score: {target.get('overall_score', target.get('score', 0))}%",
        f"Recommendation: {target.get('hiring_recommendation', 'N/A')}",
        f"Experience: {target.get('experience_years', 0)} years",
        f"Key Skills: {', '.join((target.get('matched_skills') or [])[:3])}",
        "",
        "*Note: This is a mock response because the live AI service is currently unavailable.*"
    ]
    return "\n".join(lines)