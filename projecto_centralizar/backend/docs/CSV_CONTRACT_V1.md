# API Contract: CSV Export/Import (Version v1)

This document defines the official contract for the CRM CSV system. All exports and imports MUST adhere to these rules to ensure data integrity.

## 1. File Structure
- **Format**: CSV (UTF-8 with BOM for compatibility) or XLSX.
- **Versioning**: The first column `csv_version` MUST be `v1`.

## 2. Header Contract

### Contact Row Structure
| Header | Description | Required |
| :--- | :--- | :--- |
| `csv_version` | Must be `v1` | Yes |
| `id` | Internal Contact ID (null for new) | No |
| `empresa_id` | Internal Empresa ID | No |
| `first_name` | Contact first name | No |
| `last_name` | Contact last name | No |
| `email` | Unique identity email | Yes (or linkedin) |
| `linkedin` | Profile URL | Yes (or email) |
| `empresa_nombre` | Canonical Company Name | Yes (if creating) |
| `empresa_cif` | Company Tax ID | No |
| `empresa_web` | Company Website | No |
| `campaign_ids` | Comma-separated list of IDs | No |
| `product_ids` | Comma-separated list of IDs (from Empresa) | No |

## 3. Core Rules

### 3.1. Resolution Hierarchy
When importing, the system resolves the Company in this order:
1. `empresa_id` (Highest priority)
2. `empresa_cif`
3. `empresa_web`
4. `empresa_nombre`

### 3.2. Data Overwrite Policy (Protection)
- **Empty strings (`""`)**: Are treated as "Preserve". They will **NOT** overwrite or delete existing data in the database.
- **Null Values**: To explicitly delete a value (if supported), use the marker `[DELETE]` (reserved for v2).

### 3.3. Placeholder Protection
The following values are considered **INVALID** for `empresa_nombre` and will prevent company creation:
- `N/A`, `Unknown`, `Desconocido`, `-`, `.`

### 3.4. Many-to-Many (M2M) Strategy
All relationship fields (e.g., `campaign_ids`, `sector_ids`) follow a **Merge-Append** strategy.
- Existing relations are kept.
- New IDs provided in the CSV are added to the existing set.
- Duplicate IDs are ignored.

## 4. Strict Mode
In `STRICT_IMPORT` mode (Default: ON), any mismatch between resolution filters (e.g., a CIF that belongs to a different Company Name than the one in the CSV) will cause the row to be skipped.
