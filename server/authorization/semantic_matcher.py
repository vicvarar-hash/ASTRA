from app.models import AuthRequest, AuthResponse

class SemanticSimilarityMatcher:
    def __init__(self, threshold=0.8):
        print("!!! INITIALIZING SEMSIM MATCHER V2 [SANITY PASS] !!!")
        self.threshold = threshold
        from openai import OpenAI
        import os
        # Initialize client only if we have a key, else mock it
        self.has_key = bool(os.getenv("OPENAI_API_KEY"))
        if self.has_key:
            self.client = OpenAI()

    def get_embedding(self, text, model="text-embedding-3-small"):
        if not self.has_key:
            import numpy as np
            # Return dummy embedding of length 1536
            return np.random.rand(1536).tolist()
            
        text = text.replace("\n", " ")
        return self.client.embeddings.create(input=[text], model=model).data[0].embedding

    def cosine_similarity(self, a, b):
        import numpy as np
        return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

    def evaluate(self, request: AuthRequest) -> AuthResponse:
        import os
        threshold = request.semsim_threshold if request.semsim_threshold is not None else self.threshold
        math_log = f"SemSimM Engine v2 [Decomposition Mode] | Threshold: {threshold}\n"
        
        if not os.getenv("OPENAI_API_KEY"):
             # Mock the response for the UI prototype
             ideal_embedding = self.get_embedding("Mock ideal desc")
             for tool in request.requested_tools:
                 tool_desc = request.tool_descriptions.get(tool, "")
                 if not tool_desc: return AuthResponse(decision="DENY", reasoning="Missing tool description", matcher_type="SemSimM", execution_logs={"math": "Missing description"})
                 tool_embedding = self.get_embedding(tool_desc)
                 sim = self.cosine_similarity(ideal_embedding, tool_embedding)
             return AuthResponse(decision="ALLOW", reasoning="Mocked ALLOW for SemSimM", matcher_type="SemSimM", execution_logs={"math": "Mocked threshold passed"})

        # Step 1: Generate Operational Capabilities from Task Text
        sys_prompt = """You are a cloud security architect. Read the task and identify 3-5 high-level Operational Capabilities required to fulfill it.
Examples of capabilities: 'Document Content Modification', 'Infrastructure Log Querying', 'User Authentication Management', 'Cloud Resource Provisioning', 'External API Integration'.
Output ONLY a JSON object: {"capabilities": ["Cap 1", "Cap 2", ...]}"""
        
        math_log += f"Decomposition Prompt: {sys_prompt}\nTask: {request.task_text}\n\n"
        
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": request.task_text}
            ],
            response_format={"type": "json_object"},
            temperature=0
        )
        
        import json
        primitive_actions = []
        try:
            content = response.choices[0].message.content
            if content:
                # Handle potential markdown wrapping
                if "```json" in content:
                    content = content.replace("```json", "").replace("```", "").strip()
                
                raw_data = json.loads(content)
                if isinstance(raw_data, dict):
                    # Look for 'capabilities' or 'actions' or any list
                    if "capabilities" in raw_data:
                        primitive_actions = raw_data["capabilities"]
                    else:
                        for v in raw_data.values():
                            if isinstance(v, list):
                                primitive_actions = v
                                break
                elif isinstance(raw_data, list):
                    primitive_actions = raw_data
        except Exception as e:
            math_log += f"Parsing error: {e}. Falling back to default capability.\n"
            print(f"!!! DECOMPOSITION PARSE ERROR: {e} !!!")

        # Sanitize: Ensure we have a list of non-empty strings
        primitive_actions = [str(p) for p in (primitive_actions or []) if p is not None and str(p).strip()]
        
        if not primitive_actions:
            primitive_actions = ["General Tool Execution", "System Data Interaction"]

        print(f"!!! SEMSIM V2 DECOMPOSITION: {primitive_actions} !!!")
        math_log += f"Operational Capability Decomposition: {primitive_actions}\n\n"

        # Step 2: Embed all primitives
        primitive_embeddings = [self.get_embedding(p) for p in primitive_actions]
        
        # Step 2: Compare to actual tool description
        for tool in request.requested_tools:
            # Use functional description if available for better semantic matching
            functional_desc = (request.functional_tool_descriptions or {}).get(tool, "")
            raw_desc = request.tool_descriptions.get(tool, "")
            
            tool_desc = functional_desc if functional_desc else raw_desc
            desc_source = "Functional View" if functional_desc else "Technical Spec"
            
            if not tool_desc:
                math_log += f"Missing tool description for: {tool}\n"
                return AuthResponse(decision="DENY", reasoning="Missing tool description", matcher_type="SemSimM", execution_logs={"math": math_log})
            
            tool_embedding = self.get_embedding(tool_desc)
            
            # Multi-target matching: find the best match amongst all primitives
            similarities = [self.cosine_similarity(tool_embedding, pe) for pe in primitive_embeddings]
            sim = max(similarities) if similarities else 0
            best_primitive = primitive_actions[similarities.index(sim)] if similarities else "N/A"
            
            math_log += f"Max Cosine Sim ({tool} vs Primitive '{best_primitive}') [{desc_source}]: {sim:.4f}\n"
            
            if sim < threshold:
                math_log += f"\nResult: DENY (Similarity {sim:.2f} below {threshold})"
                return AuthResponse(decision="DENY", reasoning=f"Similarity {sim:.2f} below threshold {threshold}", matcher_type="SemSimM", execution_logs={"math": math_log})

        math_log += f"\nResult: ALLOW (All tools matched a primitive >= {threshold})"
        return AuthResponse(decision="ALLOW", reasoning="All tools passed similarity threshold against task primitives.", matcher_type="SemSimM", execution_logs={"math": math_log})
