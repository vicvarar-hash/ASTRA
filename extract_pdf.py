import sys
import subprocess

def install_and_import(package):
    try:
        __import__(package)
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", package, "--user"])
        __import__(package)

install_and_import('pypdf')
from pypdf import PdfReader

reader = PdfReader("Delegated Autorization for Agents Constrained to Semactic Task-to-Scope Matching.pdf")
text = ""
for page in reader.pages:
    text += page.extract_text() + "\n"

with open("paper_text.txt", "w", encoding="utf-8") as f:
    f.write(text)

print("Extraction complete. Extracted {} characters".format(len(text)))
