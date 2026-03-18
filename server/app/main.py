from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, StreamingResponse
from app.models import AuthRequest
from authorization.semantic_matcher import SemanticSimilarityMatcher
from authorization.llm_reasoner import LLMReasoningMatcher
from authorization.tsphol_engine import TSPholeEngine
from dataset_connector.github_loader import load_dataset, normalize_dataset
import pandas as pd
from typing import Dict, Any
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="TS-PHOL Evaluation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize matchers
semsim_matcher = SemanticSimilarityMatcher(threshold=0.8)
llm_matcher = LLMReasoningMatcher()
# Mock policy for prototype
mock_policy = {
    "search_issues": ["github_official.search_issues", "search_issues"],
    "get_issue": ["github_official.get_issue", "github_official.read_issue"]
}
# We will instantiate TS-PHOL dynamically in run_experiment


@app.get("/")
def health_check():
    return {"status": "ok", "message": "TS-PHOL API is running"}

@app.get("/datasets")
def get_datasets(complexity: int = 1, type: str = "ASTRA"):
    """Fetch and normalize datasets from GitHub."""
    records = load_dataset(complexity, type)
    normalized = normalize_dataset(records, complexity, type)
    return {"count": len(normalized), "data": normalized}


@app.post("/experiment/run")
def run_experiment(payload: Dict[str, Any]):
    """
    Run the batch experiment over the dataset.
    """
    complexity = payload.get("complexity", 1)
    dataset_type = payload.get("dataset_type", "ASTRA")
    provider = payload.get("provider", "openai").lower()
    api_key = payload.get("api_key", None)
    sample_size = payload.get("sample_size", 10)
    policy_rules = payload.get("policy_rules", mock_policy)
    
    # Instantiate the engine with the provided or default policy
    dynamic_tsphol = TSPholeEngine(policy_rules=policy_rules)
    
    # 1. Load data
    records = load_dataset(complexity, dataset_type)
    
    # Randomly sample the requested number of records
    import random
    if sample_size < len(records):
        records = random.sample(records, sample_size)
    
    normalized = normalize_dataset(records, complexity, dataset_type)
    
    results = []
    
    # 2. Run matchers
    for item in normalized:
        req = AuthRequest(
            task_text=item["task_text"],
            requested_tools=item["requested_tools"],
            tool_descriptions=item["tool_descriptions"],
            requested_mcp_servers=item["requested_mcp_servers"],
            provider=provider,
            api_key=api_key,
            semsim_threshold=payload.get("semsim_threshold", 0.8)
        )
        
        # Run SemSimM
        semsim_res = semsim_matcher.evaluate(req)
        
        # Run LLM-ResM
        llm_res = llm_matcher.evaluate(req)
        
        # Run TS-PHOL
        tsphol_res = dynamic_tsphol.evaluate(req)
        
        results.append({
            "task": item["task_text"],
            "requested_tools": item["requested_tools"],
            "groundtruth_tag": item["match_tag"],
            "semsim_decision": semsim_res.decision,
            "semsim_reasoning": semsim_res.reasoning,
            "semsim_logs": semsim_res.execution_logs,
            "llm_decision": llm_res.decision,
            "llm_reasoning": llm_res.reasoning,
            "llm_logs": llm_res.execution_logs,
            "tsphol_decision": tsphol_res.decision,
            "tsphol_reasoning": tsphol_res.reasoning,
            "tsphol_logs": tsphol_res.execution_logs
        })
        
    # 3. Calculate metrics (Mock logic for UI visualization)
    # True Positive = matcher ALLOWED and groundtruth is 'correct'
    # False Positive = matcher ALLOWED and groundtruth is 'wrong' or 'null'
    
    def calc_metrics(key):
        tp = sum(1 for r in results if r[key] == "ALLOW" and r["groundtruth_tag"] == "correct")
        fp = sum(1 for r in results if r[key] == "ALLOW" and r["groundtruth_tag"] != "correct")
        fn = sum(1 for r in results if r[key] == "DENY" and r["groundtruth_tag"] == "correct")
        
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
        
        return {"precision": round(precision,2), "recall": round(recall, 2), "f1": round(f1, 2)}
    
    metrics = {
        "semsim": calc_metrics("semsim_decision"),
        "llm_res": calc_metrics("llm_decision"),
        "tsphol": calc_metrics("tsphol_decision")
    }

    return {
        "status": "success",
        "total_evaluated": len(results),
        "metrics": metrics,
        "raw_results": results
    }

@app.post("/experiment/stream")
def stream_experiment(payload: Dict[str, Any]):
    import json
    def event_generator():
        complexity = payload.get("complexity", 1)
        dataset_type = payload.get("dataset_type", "ASTRA")
        provider = payload.get("provider", "openai").lower()
        api_key = payload.get("api_key", None)
        sample_size = payload.get("sample_size", 10)
        policy_rules = payload.get("policy_rules", {})
        
        dynamic_tsphol = TSPholeEngine(policy_rules)
        semsim_matcher = SemanticSimilarityMatcher()
        llm_matcher = LLMReasoningMatcher()
        
        records = load_dataset(complexity, dataset_type, split="validation.json" if dataset_type == "ASTRA" else "processed.json")
        normalized = normalize_dataset(records, complexity, dataset_type)
        
        exact_tasks = payload.get("exact_tasks", None)
        if exact_tasks is not None:
            # Use composite key to distinguish identical prompts with different ground-truth (e.g., CORRECT vs WRONG scopes)
            task_map = {f"{n['task_text']}::{n['match_tag']}": n for n in normalized}
            normalized = []
            for t in exact_tasks:
                if t in task_map:
                    normalized.append(task_map[t])
        else:
            import random
            if sample_size < len(normalized):
                normalized = random.sample(normalized, sample_size)
            
        yield json.dumps({"type": "init", "total": len(normalized)}) + "\n"
        
        results = []
        for item in normalized:
            req = AuthRequest(
                task_text=item["task_text"],
                requested_tools=item["requested_tools"],
                tool_descriptions=item["tool_descriptions"],
                requested_mcp_servers=item["requested_mcp_servers"],
                provider=provider,
                api_key=api_key,
                semsim_threshold=payload.get("semsim_threshold", 0.8)
            )
            
            semsim_res = semsim_matcher.evaluate(req)
            llm_res = llm_matcher.evaluate(req)
            tsphol_res = dynamic_tsphol.evaluate(req)
            
            res_dict = {
                "task": item["task_text"],
                "requested_tools": item["requested_tools"],
                "groundtruth_tag": item["match_tag"],
                "semsim_decision": semsim_res.decision,
                "semsim_reasoning": semsim_res.reasoning,
                "semsim_logs": semsim_res.execution_logs,
                "llm_decision": llm_res.decision,
                "llm_reasoning": llm_res.reasoning,
                "llm_logs": llm_res.execution_logs,
                "tsphol_decision": tsphol_res.decision,
                "tsphol_reasoning": tsphol_res.reasoning,
                "tsphol_logs": tsphol_res.execution_logs
            }
            results.append(res_dict)
            yield json.dumps({"type": "trace", "data": res_dict}) + "\n"
            
        def calc_metrics(key):
            # True Positives: Authorized a correct request
            tp = sum(1 for r in results if r[key] == "ALLOW" and r["groundtruth_tag"] == "correct")
            # False Positives: Authorized a malicious request
            fp = sum(1 for r in results if r[key] == "ALLOW" and r["groundtruth_tag"] != "correct")
            # False Negatives: Denied a correct request
            fn = sum(1 for r in results if r[key] == "DENY" and r["groundtruth_tag"] == "correct")
            # True Negatives: Denied a malicious request
            tn = sum(1 for r in results if r[key] == "DENY" and r["groundtruth_tag"] != "correct")
            
            # The traditional F1 formula ignores TN. For a security scanner, catching TN is highly important.
            # We will return standard Precision/Recall/F1, but also calculate a broad 'Accuracy' that respects TN.
            precision = tp / (tp + fp) if (tp + fp) > 0 else 0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 0
            f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
            accuracy = (tp + tn) / len(results) if len(results) > 0 else 0
            
            return {
                "precision": round(precision,2), 
                "recall": round(recall, 2), 
                "f1": round(f1, 2),
                "accuracy": round(accuracy, 2)
            }
            
        metrics = {
            "semsim": calc_metrics("semsim_decision"),
            "llm_res": calc_metrics("llm_decision"),
            "tsphol": calc_metrics("tsphol_decision")
        }
        
        yield json.dumps({"type": "finish", "metrics": metrics, "raw_results": results}) + "\n"
        
    return StreamingResponse(event_generator(), media_type="application/x-ndjson")


@app.post("/experiment/explain")
def explain_metrics(payload: Dict[str, Any]):
    import json
    import os
    
    provider = payload.get("provider", "openai").lower()
    metrics = payload.get("metrics", {})
    
    # Prioritize payload key, fallback to local env
    api_key = payload.get("api_key")
    if not api_key:
        if provider == "openai":
            api_key = os.getenv("OPENAI_API_KEY")
        elif provider == "anthropic":
            api_key = os.getenv("ANTHROPIC_API_KEY")
        elif provider == "gemini":
            api_key = os.getenv("GEMINI_API_KEY")
            
    if not api_key:
        return {"explanation": f"Please provide an API key in the UI or set the local {provider.upper()}_API_KEY environment variable to generate the AI explanation."}
        
    prompt = f"""You are an AI Security Analyst reviewing the performance of three autonomous agent authorization models:
SemSimM (Semantic Similarity), LLM-ResM (Generative Reasoning), and TS-PHOL (Deterministic Graph).

Here are their metrics for a recent test:
{json.dumps(metrics, indent=2)}

Write a concise diagnostic explaining exactly what each score (F1, Precision, Recall, Accuracy) means in plain English, how it is calculated, and why certain models may have succeeded or failed based on these metrics. Use markdown formatting to bold key terms. Highlight key findings."""
    
    try:
        if provider == "openai":
            from openai import OpenAI
            client = OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7
            )
            return {"explanation": response.choices[0].message.content}
        elif provider == "anthropic":
            from anthropic import Anthropic
            client = Anthropic(api_key=api_key)
            response = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=500,
                messages=[{"role": "user", "content": prompt}]
            )
            return {"explanation": response.content[0].text}
        elif provider == "gemini":
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-1.5-pro")
            response = model.generate_content(prompt)
            return {"explanation": response.text}
    except Exception as e:
        return {"explanation": f"Failed to generate explanation: {e}"}


@app.post("/policy/load")
def load_policy(payload: Dict[str, Any]):
    """
    Load a pre-computed TS-PHOL policy graph from the cache directory.
    """
    complexity = payload.get("complexity", 1)
    dataset_type = payload.get("dataset_type", "ASTRA")
    
    import os
    import json
    
    # Path to the generated policy JSON
    cache_path = os.path.join(os.path.dirname(__file__), '..', 'data_cache', f'{dataset_type}_{complexity}_generated_policy.json')
    
    if os.path.exists(cache_path):
        try:
            with open(cache_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            return {"error": f"Failed to load cached policy: {e}"}
            
    # Return a default fallback if not generated yet
    return {
        "search_issues": ["github_official.search_issues"],
        "get_issue": ["github_official.get_issue", "github_official.read_issue"],
        "_error": "No pre-computed policy found for this dataset/complexity. Please run the generation script."
    }
