# ForgeMatch Backend

Run from the repository root:

```powershell
cd backend
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

The ranking pipeline is CPU-only and does not call external APIs during ranking. It accepts JSON, JSONL, CSV, TXT, and uploaded resume-like files through the existing `/rank-resumes` endpoint used by the Next.js app.

