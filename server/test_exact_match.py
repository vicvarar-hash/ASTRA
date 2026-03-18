import json
import sys
sys.path.append('c:/Users/vivargas/Antigravity/ASTRA/ASTRA/server')
from dataset_connector.github_loader import load_dataset, normalize_dataset

# Simulate the UI sending the Re-Run exactly as the user experienced
# The user's specific exact_task from the UI
records = load_dataset(1, "ASTRA", split="validation.json")
normalized = normalize_dataset(records, 1, "ASTRA")

task_map = {f"{n['task_text']}::{n['match_tag']}": n for n in normalized}

with open("debug_mismatch.txt", "w", encoding="utf-8") as f:
    f.write(f"Total tasks in map: {len(task_map)}\n")
    for k in list(task_map.keys())[:5]:
        f.write(f"Key preview: {repr(k)}\n")
