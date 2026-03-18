from app.models import AuthRequest, AuthResponse

class SemanticSimilarityMatcher:
    def __init__(self, threshold=0.8):
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
        math_log = f"Configured SemSimM Threshold: {threshold}\n"
        
        if not os.getenv("OPENAI_API_KEY"):
             # Mock the response for the UI prototype
             ideal_embedding = self.get_embedding("Mock ideal desc")
             for tool in request.requested_tools:
                 tool_desc = request.tool_descriptions.get(tool, "")
                 if not tool_desc: return AuthResponse(decision="DENY", reasoning="Missing tool description", matcher_type="SemSimM", execution_logs={"math": "Missing description"})
                 tool_embedding = self.get_embedding(tool_desc)
                 sim = self.cosine_similarity(ideal_embedding, tool_embedding)
             return AuthResponse(decision="ALLOW", reasoning="Mocked ALLOW for SemSimM", matcher_type="SemSimM", execution_logs={"math": "Mocked threshold passed"})

        # Step 1: Generate ideal tool description from Task Text
        sys_prompt = "You are a helpful AI. Read the task and output ONLY technical function signatures and core actions describing the ideal tool that would satisfy this request. Maximum 2 sentences. No marketing language."
        math_log += f"Ideal Tool Prompt: {sys_prompt}\nTask: {request.task_text}\n\n"
        
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": request.task_text}
            ],
            temperature=0
        )
        ideal_description = response.choices[0].message.content
        math_log += f"Ideal Tool Description Gen: {ideal_description}\n\n"

        ideal_embedding = self.get_embedding(ideal_description)
        
        # Step 2: Compare to actual tool description
        for tool in request.requested_tools:
            tool_desc = request.tool_descriptions.get(tool, "")
            if not tool_desc:
                math_log += f"Missing tool description for: {tool}\n"
                return AuthResponse(decision="DENY", reasoning="Missing tool description", matcher_type="SemSimM", execution_logs={"math": math_log})
            
            tool_embedding = self.get_embedding(tool_desc)
            sim = self.cosine_similarity(ideal_embedding, tool_embedding)
            math_log += f"Cosine Sim ({tool} vs Ideal): {sim:.4f}\n"
            
            if sim < threshold:
                math_log += f"\nResult: DENY (Similarity below {threshold})"
                return AuthResponse(decision="DENY", reasoning=f"Similarity {sim:.2f} below threshold {threshold}", matcher_type="SemSimM", execution_logs={"math": math_log})

        math_log += f"\nResult: ALLOW (All tools >= {threshold})"
        return AuthResponse(decision="ALLOW", reasoning="All tools passed similarity threshold.", matcher_type="SemSimM", execution_logs={"math": math_log})
