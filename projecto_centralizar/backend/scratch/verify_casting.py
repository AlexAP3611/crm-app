import sys
import os

# Mock the logic in a small script to verify behavior
def safe_str(val):
    if val is None:
        return None
    if isinstance(val, float) and val.is_integer():
        val = int(val)
    return str(val).strip() or None

# Test cases
test_cases = [
    (986561216.0, "986561216"), # Excel style phone
    (986561216, "986561216"),   # CSV/Int style phone
    ("986561216", "986561216"), # String style
    (None, None),
    ("", None),
    ("  ", None),
    (123.45, "123.45"),         # Regular float (should stay stringified as is)
]

print("Verificando comportamiento de safe_str:")
all_passed = True
for input_val, expected in test_cases:
    result = safe_str(input_val)
    if result == expected:
        print(f"✅ OK: {input_val!r} -> {result!r}")
    else:
        print(f"❌ FAIL: {input_val!r} -> {result!r} (esperado {expected!r})")
        all_passed = False

# Mock numeric casting
def test_numeric_casting(val, target_type):
    try:
        return target_type(val)
    except (ValueError, TypeError):
        return None

print("\nVerificando casteo numérico:")
num_tests = [
    ("100", int, 100),
    (100.0, int, 100),
    ("invalid", int, None),
    ("1500.50", float, 1500.50),
    (1500, float, 1500.0),
    (None, int, None),
]

for val, t, expected in num_tests:
    result = test_numeric_casting(val, t)
    if result == expected:
        print(f"✅ OK: {val!r} ({type(val)}) -> {result!r}")
    else:
        print(f"❌ FAIL: {val!r} ({type(val)}) -> {result!r} (esperado {expected!r})")
        all_passed = False

if all_passed:
    print("\n¡Todas las pruebas pasaron!")
else:
    print("\nAlgunas pruebas fallaron.")
    sys.exit(1)
