"""
TS-PHOL Deductive Policy Generator
====================================
Instead of empirical scenario induction (learning from sparse test samples),
this script uses DEDUCTIVE TOOL CLUSTERING:

  1. Reads all MCP server JSON files directly (100% tool coverage)
  2. Sends batches of tools + descriptions to the LLM
  3. Asks the LLM to classify each tool into one of 12 Abstract Capabilities
  4. Merges the results into a dense, complete TS-PHOL policy graph JSON

This guarantees that every tool in the ecosystem is mapped to a capability,
eliminating false negatives caused by unsampled tools.
"""

import os
import json
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environments to access LLM keys
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

ABSTRACT_TAXONOMY = [
    "Search_Literature",    # Searching for academic or reference papers
    "Read_Literature",      # Reading or downloading academic content
    "Download_Literature",  # Downloading PDFs or full paper content
    "Search_Code",          # Searching for code, repos, issues, PRs
    "Read_Code",            # Reading file contents, commits, diffs
    "Write_Code",           # Creating/modifying files, PRs, branches
    "Search_Finance",       # Querying financial data, indicators, market data
    "Read_Finance",         # Reading financial records, fund details
    "Search_Web",           # General web or data queries
    "Data_Analysis",        # Running computations, visualizations, analytics
    "Data_Engineering",     # Managing databases, schemas, ETL pipelines
    "System_Admin",         # Managing deployments, CI/CD, workflows
    "Cloud_Infrastructure_Read",  # Reading cloud state (Azure, AWS, Gcp)
    "Cloud_Infrastructure_Write", # Mutating cloud state (Azure, AWS, Gcp)
    "Identity_Management",  # Managing users, roles, IAM policies, auth
    "Network_Management",   # Managing VPCs, firewalls, routing, DNS
    "Security_Compliance",  # Auditing, security alerts, compliance checks
    "General_QA",           # Look-up, annotation tasks, misc queries
]

MCP_SERVERS_BASE = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'mcp_servers')

BATCH_SIZE = 30  # How many tools to classify per LLM call


def load_all_mcp_tools(dataset_type: str) -> dict:
    """
    Reads all MCP server JSON files for a given dataset type and returns
    a unified dict of {tool_name: description, ...}.
    """
    mcp_dir = os.path.join(MCP_SERVERS_BASE, dataset_type)
    tools_library = {}

    if not os.path.exists(mcp_dir):
        print(f"  [!] MCP server directory not found: {mcp_dir}")
        return tools_library

    server_files = list(Path(mcp_dir).glob("*.json"))
    print(f"  [+] Found {len(server_files)} MCP server definitions in {dataset_type}")

    for server_file in server_files:
        try:
            with open(server_file, 'r', encoding='utf-8') as f:
                server_data = json.load(f)

            tools = server_data.get("tools", [])
            for tool in tools:
                name = tool.get("name", "")
                desc = tool.get("description", "")
                if name:
                    tools_library[name] = desc or "(no description)"
        except Exception as e:
            print(f"  [!] Error reading {server_file.name}: {e}")

    print(f"  [+] Loaded {len(tools_library)} unique tools across all MCP servers")
    return tools_library


def classify_tools_batch(tool_batch: dict, provider: str, api_key: str) -> dict:
    """
    Sends a batch of {tool_name: description} pairs to the LLM and receives
    a mapping of {tool_name: abstract_capability}.
    Returns the partial policy assignments dict.
    """
    # Build tool list string
    tool_list_str = ""
    for name, desc in tool_batch.items():
        tool_list_str += f"- {name}: {desc[:200]}\n"

    taxonomy_str = "\n".join(f"  - {t}" for t in ABSTRACT_TAXONOMY)

    prompt = f"""You are a security policy classifier for TS-PHOL (Tool-Scoped Policy and High-Order Logic).

Your task is to classify each tool below into the provided Abstract Capability categories.
Since tools can span multiple operational domains, you must choose up to 3 of the MOST SPECIFIC categories that apply. Every tool must be assigned at least one category.

Abstract Capability Taxonomy:
{taxonomy_str}

Tools to classify:
{tool_list_str}

Output ONLY a raw valid JSON object (no markdown, no explanation) mapping each tool name to a list of its capabilities:
{{
  "tool_name_1": ["Abstract_Capability_A", "Abstract_Capability_B"],
  "tool_name_2": ["Abstract_Capability_C"]
}}
"""

    import json as json_module

    from data_cache.sqlite_cache import get_cached_response, set_cached_response

    cached_resp = get_cached_response(prompt, provider, "policy_classifier")
    if cached_resp:
        try:
            return json_module.loads(cached_resp)
        except Exception:
            pass

    try:
        if provider == "openai":
            from openai import OpenAI
            client = OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a strict JSON classifier. Output ONLY valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0
            )
            data = json_module.loads(response.choices[0].message.content)
            completion_text = response.choices[0].message.content

        elif provider == "anthropic":
            from anthropic import Anthropic
            client = Anthropic(api_key=api_key)
            response = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1500,
                messages=[{"role": "user", "content": prompt}]
            )
            completion_text = response.content[0].text.replace("```json", "").replace("```", "").strip()
            data = json_module.loads(completion_text)

        elif provider == "gemini":
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-1.5-pro")
            response = model.generate_content(prompt)
            completion_text = response.text.replace("```json", "").replace("```", "").strip()
            data = json_module.loads(completion_text)
        else:
            data = {}
            completion_text = "{}"

        set_cached_response(prompt, provider, "policy_classifier", json_module.dumps(data))
        return data

    except Exception as e:
        print(f"    [!] Batch classification error: {e}")
        return {}


def build_policy_graph(tool_classifications: dict) -> dict:
    """
    Converts {tool_name: [abstract_capability, ...]} into the TS-PHOL policy format:
    {abstract_capability: [tool_name, ...]}
    """
    policy_graph = {}
    for tool_name, capabilities in tool_classifications.items():
        if isinstance(capabilities, str):
            capabilities = [capabilities]
            
        for capability in capabilities:
            # Normalize: ensure it's a valid taxonomy member
            if capability not in ABSTRACT_TAXONOMY:
                # Try to fix case mismatches
                matched = next((t for t in ABSTRACT_TAXONOMY if t.lower() == capability.lower()), "General_QA")
                capability = matched
    
            if capability not in policy_graph:
                policy_graph[capability] = []
            if tool_name not in policy_graph[capability]:
                policy_graph[capability].append(tool_name)

    return policy_graph


def generate_all_policies(provider: str = "openai"):
    print(f"\n{'='*60}")
    print(f"TS-PHOL DEDUCTIVE POLICY GENERATOR")
    print(f"Strategy: Tool Clustering from MCP Server Definitions")
    print(f"Provider: {provider.upper()}")
    print(f"{'='*60}\n")

    api_key = os.getenv(f"{provider.upper()}_API_KEY")
    if not api_key:
        print(f"[!] Warning: No API key found for {provider}. Cannot proceed.")
        return

    for dataset_type in ["ASTRA", "TOUCAN"]:
        print(f"\n{'─'*50}")
        print(f"[*] Processing dataset: {dataset_type}")
        print(f"{'─'*50}")

        # Step 1: Load ALL tools from all MCP servers
        tools_library = load_all_mcp_tools(dataset_type)

        if not tools_library:
            print(f"  [!] No tools found for {dataset_type}, skipping.")
            continue

        # Step 2: Classify tools in batches
        tool_items = list(tools_library.items())
        all_classifications = {}

        total_batches = (len(tool_items) + BATCH_SIZE - 1) // BATCH_SIZE
        print(f"\n  [*] Classifying {len(tool_items)} tools in {total_batches} batches of {BATCH_SIZE}...")

        for batch_idx in range(0, len(tool_items), BATCH_SIZE):
            batch_chunk = dict(tool_items[batch_idx:batch_idx + BATCH_SIZE])
            batch_num = (batch_idx // BATCH_SIZE) + 1
            print(f"  [Batch {batch_num}/{total_batches}] Classifying {len(batch_chunk)} tools...")

            result = classify_tools_batch(batch_chunk, provider, api_key)
            all_classifications.update(result)
            print(f"    [+] Classified {len(result)} tools in this batch")

        # Step 3: Build the policy graph (inverted: capability -> [tools])
        policy_graph = build_policy_graph(all_classifications)

        # Report coverage
        total_classified = sum(len(v) for v in policy_graph.values())
        print(f"\n  [+] Policy Graph Summary for {dataset_type}:")
        for capability, tools in sorted(policy_graph.items()):
            print(f"      {capability}: {len(tools)} tools")
        print(f"\n  [+] Total tools classified: {total_classified} / {len(tools_library)}")

        # Step 4: We generate one policy per complexity level
        # (Since the tools don't change by complexity, we apply the same graph to all 3 levels)
        for complexity in [1, 2, 3]:
            output_path = os.path.join(
                os.path.dirname(__file__), '..', 'data_cache',
                f'{dataset_type}_{complexity}_generated_policy.json'
            )
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(policy_graph, f, indent=2)
            print(f"  [+] Saved: {output_path}")

    print(f"\n{'='*60}")
    print(f"[+] Deductive Policy Generation Complete!")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(
        description="TS-PHOL Deductive Policy Generator — classifies ALL tools via LLM"
    )
    parser.add_argument(
        "--provider", type=str, default="openai",
        help="LLM Provider to use for tool classification (openai, gemini, anthropic)"
    )

    args = parser.parse_args()
    generate_all_policies(args.provider)
