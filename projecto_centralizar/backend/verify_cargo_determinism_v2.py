import asyncio
import os
import sys

sys.path.append(os.getcwd())

from app.database import engine, AsyncSession
from app.services.cargo_service import resolve_cargo

async def verify_robust_normalization():
    print("--- Verifying Robust Cargo Normalization (V2) ---")
    
    test_cases = [
        ("C.M.O", "chief marketing officer"),
        ("C-M-O", "chief marketing officer"),
        ("C/M/O", "chief marketing officer"),
        ("Chief..Marketing--Officer", "chief marketing officer"),
        ("  CHIEF MARKETING OFFICER  ", "chief marketing officer"),
        ("CTO", "chief technology officer"),
        ("Chief Technology Officer", "chief technology officer"),
    ]
    
    async with AsyncSession(engine) as session:
        for raw_input, expected_canonical_name in test_cases:
            cargo = await resolve_cargo(session, raw_input)
            if not cargo:
                print(f"❌ FAILED: Received None for '{raw_input}'")
                continue
            
            # Since my logic title-cases the name if an alias is used:
            # expected_cargo_name should be .title() of the expanded one
            expected_display_name = expected_canonical_name.title()
            
            print(f"Input: '{raw_input}'")
            print(f"  -> Normalized: '{cargo.normalized_name}'")
            print(f"  -> Display Name: '{cargo.name}'")
            
            assert cargo.normalized_name == expected_canonical_name, f"Expected norm '{expected_canonical_name}', got '{cargo.normalized_name}'"
            print(f"✅ OK")

    print("\nVerification successful!")

if __name__ == "__main__":
    asyncio.run(verify_robust_normalization())
