import urllib.request
import json
import os

CACHE_DIR = "data_cache"

def ensure_cache_dir():
    if not os.path.exists(CACHE_DIR):
        os.makedirs(CACHE_DIR)

def fetch_json(url: str, cache_file: str):
    ensure_cache_dir()
    cache_path = os.path.join(CACHE_DIR, cache_file)
    
    if os.path.exists(cache_path):
        with open(cache_path, 'r', encoding='utf-8') as f:
            return json.load(f)
            
    print(f"Fetching from {url}...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
        
    with open(cache_path, 'w', encoding='utf-8') as f:
        json.dump(data, f)
        
    return data

def load_dataset(complexity: int, dataset_type: str = "ASTRA", split: str = "test.json"):
    """
    Loads task dataset from github.
    complexity: 1, 2, or 3
    dataset_type: 'ASTRA' or 'TOUCAN'
    split: 'test.json', 'validation.json', 'processed.json'
    """
    folder = "01_tool" if complexity == 1 else f"02_tools" if complexity == 2 else "03_tools"
    url = f"https://raw.githubusercontent.com/vicvarar-hash/ASTRA/main/data/{folder}/{dataset_type}/{split}"
    cache_name = f"dataset_{dataset_type}_{complexity}_{split.replace('.json', '')}.json"
    
    return fetch_json(url, cache_name)

def load_mcp_server(server_name: str, dataset_type: str = "ASTRA"):
    """
    Loads MCP server definitions to extract tool descriptions.
    """
    import urllib.parse
    
    if dataset_type == "ASTRA":
        formatted_name = server_name.replace('-', '_')
    else:
        formatted_name = server_name
        
    encoded_name = urllib.parse.quote(formatted_name)
    url = f"https://raw.githubusercontent.com/vicvarar-hash/ASTRA/main/data/mcp_servers/{dataset_type}/{encoded_name}.json"
    
    clean_cache_name = formatted_name.replace(' ', '_').replace('/', '_')
    cache_name = f"mcp_{dataset_type}_{clean_cache_name}.json"
    
    try:
        data = fetch_json(url, cache_name)
        return data
    except Exception as e:
        print(f"Error fetching MCP Server {server_name}: {e}")
        return {}

def normalize_dataset(records, complexity, dataset_group):
    normalized = []
    
    for r in records:
        try:
            if dataset_group == "ASTRA":
                mcp_servers = r["input"].get("mcp_servers", [])
                tool_descriptions = {}
                
                # Fetch tool descriptions dynamically from the MCP Server JSONs
                for server in mcp_servers:
                    server_data = load_mcp_server(server, dataset_group)
                    if "tools" in server_data:
                        for tool in server_data["tools"]:
                             tool_descriptions[tool["name"]] = tool.get("description", "")
                
                entry = {
                    "task_text": r["input"]["task"],
                    "requested_tools": r["input"]["tools"],
                    "requested_mcp_servers": mcp_servers,
                    "tool_descriptions": tool_descriptions,
                    "groundtruth_tools": r["groundtruth"]["tools"],
                    "groundtruth_mcp_servers": r["groundtruth"]["mcp_servers"],
                    "match_tag": r["match_tag"],
                    "complexity": complexity,
                    "dataset_group": dataset_group
                }
                normalized.append(entry)

            elif dataset_group == "TOUCAN":
                mcp_servers = r.get("mcp_servers", [])
                tool_descriptions = {}
                
                for server in mcp_servers:
                    server_data = load_mcp_server(server, dataset_group)
                    if "tools" in server_data:
                        for tool in server_data["tools"]:
                             tool_descriptions[tool["name"]] = tool.get("description", "")
                             
                task_text = r.get("synthetic_tasks", [""])[0] if r.get("synthetic_tasks") else ""
                
                entry = {
                    "task_text": task_text,
                    "requested_tools": r.get("tool_names", []),
                    "requested_mcp_servers": mcp_servers,
                    "tool_descriptions": tool_descriptions,
                    "groundtruth_tools": r.get("tool_names", []),
                    "groundtruth_mcp_servers": mcp_servers,
                    "match_tag": "correct",
                    "complexity": complexity,
                    "dataset_group": dataset_group
                }
                normalized.append(entry)

        except Exception as e:
            print(f"Error normalizing record: {e}")
            continue
            
    return normalized
