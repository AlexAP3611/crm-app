import re

def normalize_job_title(raw_value: str) -> str:
    if not raw_value:
        return ""
    
    val = raw_value.lower().strip()
    # Remove dots
    val = val.replace(".", "")
    # Replace other symbols with spaces
    val = re.sub(r'[^a-z0-9\s]', ' ', val)
    # Collapse spaces
    val = re.sub(r'\s+', ' ', val).strip()
    return val

print(f"'{normalize_job_title('C.M.O')}'")
print(f"'{normalize_job_title('C-M-O')}'")
print(f"'{normalize_job_title('Chief-Marketing/Officer')}'")
