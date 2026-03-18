from pydantic import BaseModel
from typing import List, Dict, Optional, Any

class TaskIntent(BaseModel):
    goal: str
    domain: str
    required_actions: List[str]

class AuthRequest(BaseModel):
    task_text: str
    requested_tools: List[str]
    tool_descriptions: Dict[str, str]
    requested_mcp_servers: List[str]
    provider: Optional[str] = "openai"
    api_key: Optional[str] = None
    semsim_threshold: Optional[float] = 0.8

class AuthResponse(BaseModel):
    decision: str  # "ALLOW" or "DENY"
    reasoning: Optional[str] = None
    matcher_type: str
    execution_logs: Optional[Dict[str, Any]] = None
