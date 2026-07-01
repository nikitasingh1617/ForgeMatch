import json


def build_recruiter_chat_prompt(ranking_data, question):
    rankings = ranking_data.get("rankings", [])[:5]  # Top 5 only

    compact_rankings = []

    for c in rankings:
        compact_rankings.append({
            "rank": c.get("rank"),
            "name": c.get("name"),
            "candidate_id": c.get("candidate_id"),
            "display_score": c.get("display_score"),
            "recommendation": c.get("recommendation"),
            "confidence_level": c.get("confidence_level"),

            "title": c.get("current_title"),
            "headline": c.get("headline"),
            "experience_years": c.get("experience_years"),

            "matched_skills": c.get("matched_skills"),
            "skills": c.get("skills"),
            "career_matches": c.get("career_matches"),

            "skill_match": c.get("skill_match"),
            "career_relevance": c.get("career_relevance"),
            "evidence_score": c.get("evidence_score"),
            "role_alignment_score": c.get("role_alignment_score"),
            "credibility_score": c.get("credibility_score"),
            "project_quality_score": c.get("project_quality_score"),

            "reasoning": c.get("reasoning"),
            "low_match_explanation": c.get("low_match_explanation"),
            "comparison_vs_next": c.get("comparison_vs_next"),
        })

    # Top candidate summary for context
    top_summary = None
    if rankings:
        top = rankings[0]
        top_summary = {
            "name": top.get("name"),
            "score": top.get("display_score"),
            "recommendation": top.get("recommendation"),
            "title": top.get("current_title"),
        }

    compact_data = {
        "job_domain": ranking_data.get("job_domain"),
        "job_description": ranking_data.get("job_description")[:600],
        "total_candidates": ranking_data.get("total_candidates"),
        "top_candidate_summary": top_summary,
        "top_candidates": compact_rankings,
    }

    return f"""
You are ForgeMate – an AI hiring assistant for recruiters using ForgeMatch.

You help recruiters understand candidate rankings and make better hiring decisions.

IMPORTANT RULES:
1. Use ONLY the JSON data below – never invent facts.
2. If a user asks about a candidate not listed, say: "For performance and response quality, ForgeMate AI analyzes the top 5 ranked candidates in detail during chat. To compare lower-ranked candidates, open their candidate profile or rerun the analysis with a different shortlist."
3. Keep answers concise but informative. For comparisons, use clear sections or bullet points.
4. Always include this disclaimer: "This analysis is based on ForgeMatch's AI ranking and should be validated by a human recruiter."
5. Use ranks, scores, reasoning, skills, confidence, evidence, and project quality in your answers.
6. Format answers using short sections and bullet points for clarity.
7. When the user asks "Why is #1 ranked highest?" or similar, provide 3-5 specific reasons based on the data (e.g., skill overlap, experience, evidence, project quality).
8. When comparing candidates, provide a side-by-side comparison highlighting differences in key metrics.
9. For any question, always mention the candidate's name, rank, and the most relevant metrics.

JSON:
{json.dumps(compact_data, ensure_ascii=False)}

Question:
{question}
"""