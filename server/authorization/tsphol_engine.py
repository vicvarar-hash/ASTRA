from app.models import AuthRequest, AuthResponse, TaskIntent

class TSPholeEngine:
    def __init__(self, policy_rules: dict = None):
        """
        policy_rules maps abstract actions to allowed concrete tool names.
        e.g., {"search_issues": ["github_official.search_issues"]}
        """
        import os
        self.policy_rules = policy_rules or {}

    def parse_intent(self, task_text: str, provider: str, api_key: str) -> TaskIntent:
        if not api_key:
            # Mock the parsing for UI Prototype
            return TaskIntent(goal="mock_goal", domain="github", required_actions=["search_issues"]), {"prompt": "mock", "completion": "mock"}
            
        prompt = f"""You are a structural parser for TS-PHOL.
Convert the following natural language task into a JSON structure representing a workflow.
Do not output anything except raw valid JSON.

Task: "{task_text}"

Choose `required_actions` ONLY from this standard taxonomy of abstract capabilities:
  "Search_Literature", "Read_Literature", "Download_Literature", 
  "Search_Code", "Read_Code", "Write_Code", 
  "Search_Finance", "Read_Finance", "Search_Web",
  "Data_Analysis", "Data_Engineering", "System_Admin", 
  "Cloud_Infrastructure_Read", "Cloud_Infrastructure_Write",
  "Identity_Management", "Network_Management", "Security_Compliance",
  "General_QA"

Expected JSON format:
{{
  "goal": "short summary",
  "domain": "e.g. medical, github, finance",
  "required_actions": ["Search_Literature", "Read_Literature"]
}}
"""
        from data_cache.sqlite_cache import get_cached_response, set_cached_response
        import json
        
        cached_resp = get_cached_response(prompt, provider, "tsphol_parser")
        if cached_resp:
             try:
                 data = json.loads(cached_resp)
                 return TaskIntent(**data), {"prompt": prompt, "completion": cached_resp}
             except:
                 pass # Fallback to fetching it again
                 
        try:
            if provider == "openai":
                from openai import OpenAI
                client = OpenAI(api_key=api_key)
                response = client.chat.completions.create(
                    model="gpt-4o",
                    messages=[{"role": "system", "content": "You output JSON only."}, {"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    temperature=0
                )
                data = json.loads(response.choices[0].message.content)
            elif provider == "anthropic":
                from anthropic import Anthropic
                client = Anthropic(api_key=api_key)
                response = client.messages.create(
                    model="claude-3-5-sonnet-20241022",
                    max_tokens=300,
                    messages=[{"role": "user", "content": prompt}]
                )
                # Claude might output markdown json blocks, strip them
                text = response.content[0].text.replace("```json", "").replace("```", "").strip()
                data = json.loads(text)
            elif provider == "gemini":
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                model = genai.GenerativeModel("gemini-1.5-pro")
                response = model.generate_content(prompt)
                text = response.text.replace("```json", "").replace("```", "").strip()
                data = json.loads(text)
                
            # Save successful parse to cache
            set_cached_response(prompt, provider, "tsphol_parser", json.dumps(data))
                
        except Exception as e:
            # Mock fallback if JSON fails
            print(f"Failed parsing TS-PHOL Intent with {provider}: {e}")
            return TaskIntent(goal="mock_goal", domain="github", required_actions=["search_issues"]), {"prompt": prompt, "completion": f"Error: {e}"}
            
        # If cache hit, we don't have the original text, just the json
        # In a real app we'd cache both, but for UI tracing:
        completion_str = text if 'text' in locals() else cached_resp if cached_resp else json.dumps(data, indent=2)
        return TaskIntent(**data), {"prompt": prompt, "completion": completion_str}

    def evaluate(self, request: AuthRequest) -> AuthResponse:
        import os
        provider = request.provider or "openai"
        api_key = request.api_key
        if not api_key:
             if provider == "openai": api_key = os.getenv("OPENAI_API_KEY")
             elif provider == "gemini": api_key = os.getenv("GEMINI_API_KEY")
             elif provider == "anthropic": api_key = os.getenv("ANTHROPIC_API_KEY")
             
        # Stage 1: Task Semantic Parsing
        try:
            intent, logs = self.parse_intent(request.task_text, provider, api_key)
        except Exception as e:
            return AuthResponse(decision="DENY", reasoning=f"Failed to parse intent: {e}", matcher_type="TS-PHOL", execution_logs={"prompt": "error", "completion": str(e)})

        # Stage 2 & 3: Policy Validation & Action Graph Check
        # For this prototype, we check if all requested tools are mapped in the valid actions 
        # based on our global policy rules for the extracted domain/actions
        
        # Build authorized tool list based on the parsed abstract actions
        authorized_tools = set()
        for action in intent.required_actions:
            if action in self.policy_rules:
                authorized_tools.update(self.policy_rules[action])
        
        # Stage 4: Runtime Authorization
        # If the requested tools are not in the generated graph of authorized tools, DENY.
        validation_steps = []
        validation_passed = True
        deny_reason = ""
        
        for tool in request.requested_tools:
            # We enforce a strict subset check. For an MVP without complex custom graph logic,
            # TS-PHOL policy validation is demonstrated via subset mapping.
            # (In production, this would validate temporal execution order in a DAG)
            tool_found = False
            for action in intent.required_actions:
                 if action in self.policy_rules and (tool in self.policy_rules[action] or "*" in self.policy_rules[action]):
                     tool_found = True
                     validation_steps.append(f"[\u2713] Tool '{tool}' successfully mapped to authorized capability '{action}'.")
                     break
                     
            if not tool_found:
                validation_passed = False
                deny_reason = f"Tool '{tool}' violates strict TS-PHOL policy workflow. It does not exist in any of the authorized capabilities: {intent.required_actions}"
                validation_steps.append(f"[\u2717] Tool '{tool}' FAILED to map to the allowed capabilities: {intent.required_actions}.")
                break
                
        logs["validation_trace"] = "\n".join(validation_steps)
        logs["required_capabilities"] = intent.required_actions
        
        if not validation_passed:
            return AuthResponse(decision="DENY", reasoning=deny_reason, matcher_type="TS-PHOL", execution_logs=logs)
            
        return AuthResponse(decision="ALLOW", reasoning=f"Tools strictly match allowed policy graph for actions: {intent.required_actions}", matcher_type="TS-PHOL", execution_logs=logs)
