import sqlite3
import os
import hashlib
import json

CACHE_DIR = "data_cache"
DB_PATH = os.path.join(CACHE_DIR, "llm_cache.db")

def ensure_db():
    if not os.path.exists(CACHE_DIR):
        os.makedirs(CACHE_DIR)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS api_cache (
            prompt_hash TEXT PRIMARY KEY,
            provider TEXT,
            model_type TEXT,
            response_text TEXT
        )
    ''')
    conn.commit()
    conn.close()

def get_hash(prompt: str, model_type: str) -> str:
    # Hash the combination of the prompt and the task type (e.g. semsim, llm, tsphol)
    content = f"{model_type}||{prompt}"
    return hashlib.sha256(content.encode('utf-8')).hexdigest()

def get_cached_response(prompt: str, provider: str, model_type: str):
    ensure_db()
    prompt_hash = get_hash(prompt, model_type)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT response_text FROM api_cache WHERE prompt_hash = ? AND provider = ?', (prompt_hash, provider))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return row[0]
    return None

def set_cached_response(prompt: str, provider: str, model_type: str, response_text: str):
    ensure_db()
    prompt_hash = get_hash(prompt, model_type)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT OR REPLACE INTO api_cache (prompt_hash, provider, model_type, response_text)
        VALUES (?, ?, ?, ?)
    ''', (prompt_hash, provider, model_type, response_text))
    conn.commit()
    conn.close()
