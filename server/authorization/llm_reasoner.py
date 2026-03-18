from app.models import AuthRequest, AuthResponse

class LLMReasoningMatcher:
    def __init__(self):
        # We don't initialize a single client here anymore since it's dynamic
        pass

    def evaluate(self, request: AuthRequest) -> AuthResponse:
        import os
        provider = request.provider or "openai"
        
        # Fallback to .env keys if not provided in payload
        api_key = request.api_key
        if not api_key:
             if provider == "openai": api_key = os.getenv("OPENAI_API_KEY")
             elif provider == "gemini": api_key = os.getenv("GEMINI_API_KEY")
             elif provider == "anthropic": api_key = os.getenv("ANTHROPIC_API_KEY")

        if not api_key:
            # Mock the response for the UI prototype if no key
            if "search" in request.task_text.lower() and "search_issues" in request.requested_tools:
                return AuthResponse(decision="ALLOW", reasoning=f"Mocked ALLOW for LLM-ResM ({provider})", matcher_type="LLM-ResM", execution_logs={"prompt": "mock", "completion": "mock"})
            return AuthResponse(decision="DENY", reasoning=f"Mocked DENY for LLM-ResM ({provider})", matcher_type="LLM-ResM", execution_logs={"prompt": "mock", "completion": "mock"})
            
        tools_str = ", ".join(request.requested_tools)
        desc_str = "\n".join([f"- {tool}: {desc}" for tool, desc in request.tool_descriptions.items()])
        
        prompt = f"""Task: {request.task_text}
Requested Tools: {tools_str}
Tool Descriptions: 
{desc_str}

Question: Are these tools strictly appropriate and necessary for completing the given task?
Respond with exactly one word on the first line: ALLOW or DENY.
Then provide a brief 1-sentence reasoning on the next line."""
        
        from data_cache.sqlite_cache import get_cached_response, set_cached_response
        
        cached_resp = get_cached_response(prompt, provider, "llm_resm")
        if cached_resp:
             response_text = cached_resp
        else:
             response_text = ""
             try:
                 if provider == "openai":
                     from openai import OpenAI
                     client = OpenAI(api_key=api_key)
                     resp = client.chat.completions.create(
                         model="gpt-4o",
                         messages=[{"role": "user", "content": prompt}],
                         temperature=0
                     )
                     response_text = resp.choices[0].message.content.strip()
                 elif provider == "anthropic":
                     from anthropic import Anthropic
                     client = Anthropic(api_key=api_key)
                     resp = client.messages.create(
                         model="claude-3-5-sonnet-20241022",
                         max_tokens=100,
                         messages=[{"role": "user", "content": prompt}]
                     )
                     response_text = resp.content[0].text.strip()
                 elif provider == "gemini":
                     import google.generativeai as genai
                     genai.configure(api_key=api_key)
                     model = genai.GenerativeModel("gemini-1.5-pro")
                     resp = model.generate_content(prompt)
                     response_text = resp.text.strip()
                     
                 # Save to cache on success
                 set_cached_response(prompt, provider, "llm_resm", response_text)
                 
             except Exception as e:
                 return AuthResponse(decision="DENY", reasoning=f"API Error ({provider}): {str(e)}", matcher_type="LLM-ResM")
        
        content = response_text.split('\n')
        decision = content[0].strip().upper()
        reasoning = content[1] if len(content) > 1 else ""

        if "ALLOW" in decision:
            return AuthResponse(decision="ALLOW", reasoning=reasoning, matcher_type="LLM-ResM", execution_logs={"prompt": prompt, "completion": response_text})
        else:
            return AuthResponse(decision="DENY", reasoning=reasoning, matcher_type="LLM-ResM", execution_logs={"prompt": prompt, "completion": response_text})
