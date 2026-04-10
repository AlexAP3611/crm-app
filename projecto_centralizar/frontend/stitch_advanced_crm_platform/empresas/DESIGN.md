# Design System Specification: Editorial Precision CRM

## 1. Overview & Creative North Star
### Creative North Star: "The Architectural Ledger"
In an era of cluttered, grid-locked CRMs, this design system serves as a "Digital Architect"—transforming dense data into an editorial experience. We move away from the "software-in-a-box" aesthetic toward a sophisticated, layered environment that feels more like a high-end financial journal than a database.

The system breaks the standard template look through **intentional asymmetry** and **tonal depth**. By utilizing oversized typography scales against expansive white space, we create a visual rhythm that guides the user’s eye to high-value insights, leaving secondary data to recede into the background.

---

## 2. Colors & Surface Philosophy
The palette is built on a foundation of "Slate & Snow," punctuated by the electric energy of the primary cyan and a high-impact tertiary raspberry.

### The "No-Line" Rule
**Strict Mandate:** Designers are prohibited from using 1px solid borders to section off the UI. 
Boundaries must be defined exclusively through background color shifts. For example, a `surface-container-low` side panel should sit flush against a `surface` background. Containment is an exercise in tonal contrast, not structural lines.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—stacked sheets of frosted glass.
- **Base Layer:** `surface` (#fbf9f8)
- **Primary Containers:** `surface-container-low` (#f5f3f3) for secondary grouping.
- **High-Focus Elements:** `surface-container-lowest` (#ffffff) for active cards and data entry areas to create a "lifted" feel.

### The "Glass & Gradient" Rule
To escape the "flat" SaaS aesthetic, floating elements (modals, dropdowns) must utilize **Glassmorphism**. 
- **Recipe:** `surface` color at 80% opacity + `backdrop-blur: 20px`.
- **Signature Texture:** Primary CTAs should not be flat. Use a linear gradient (135°) from `primary` (#006877) to `primary_container` (#00bbd4) to provide a "lit-from-within" professional soul.

---

## 3. Typography
We pair the structural authority of **Plus Jakarta Sans** for displays with the hyper-legibility of **Inter** for data.

| Role | Token | Font | Size | Intent |
| :--- | :--- | :--- | :--- | :--- |
| **Display** | `display-lg` | Plus Jakarta | 3.5rem | High-level KPI values and hero titles. |
| **Headline** | `headline-md` | Plus Jakarta | 1.75rem | Section headers / Page titles. |
| **Title** | `title-md` | Inter | 1.125rem | Card titles and prominent labels. |
| **Body** | `body-md` | Inter | 0.875rem | Standard data entries and descriptions. |
| **Label** | `label-sm` | Inter | 0.6875rem | Metadata, tags, and micro-copy. |

**Editorial Note:** Use `tertiary` (#be003b) sparingly in typography only for urgent status alerts or "High-Value Lead" markers to create a sharp, intentional contrast against the cool slate tones.

---

## 4. Elevation & Depth
Depth is achieved through **Tonal Layering** rather than traditional drop shadows.

- **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` background. This creates a soft, natural lift that mimics fine stationery.
- **Ambient Shadows:** When a floating state is required (e.g., a dragged card), use an extra-diffused shadow: `box-shadow: 0 20px 40px rgba(27, 28, 28, 0.06)`. The shadow color is a tinted version of `on-surface` to feel organic.
- **The "Ghost Border" Fallback:** If a border is required for accessibility in input fields, use `outline-variant` (#bbc9cc) at **15% opacity**. Never use 100% opaque borders.

---

## 5. Components

### Buttons
- **Primary:** Gradient (`primary` to `primary_container`), `md` (0.75rem) roundedness. White text. No shadow.
- **Secondary:** `surface-container-highest` background with `on-surface` text. Feels "embedded" in the page.
- **Tertiary:** Transparent background, `primary` text, bold weight. For low-priority actions.

### Data Tables (The CRM Heart)
- **Forbid Dividers:** Do not use horizontal lines between rows. Use `8px` of vertical padding and a subtle `surface-container-low` hover state to highlight rows.
- **Header:** Use `label-md` in `on-surface-variant` for column headers to ensure they don't compete with actual lead data.

### Input Fields
- **Style:** "Floating Label" style. Background is `surface-container-lowest`. 
- **Active State:** A 2px bottom-only accent in `primary`. Avoid boxing the input; keep it airy and open.

### Contextual Chips
- **Selection Chips:** `primary_fixed` background with `on_primary_fixed` text. Roundedness: `full`.
- **Status Chips:** Use `tertiary_container` for "Hot Leads" and `secondary_container` for "Archived."

### CRM-Specific Components
- **The Progress Ribbon:** A slim, 4px tall gradient bar at the top of lead cards indicating "Deal Stage," utilizing the `primary` to `tertiary` spectrum.
- **Activity Feed:** Use a "Threaded" layout without lines; use staggered indentation and `surface-container` shifts to denote time-blocks.

---

## 6. Do's and Don'ts

### Do
- **Do** use `display-lg` for single, impactful numbers (e.g., Total Revenue).
- **Do** maximize white space. If a layout feels "full," increase the `surface` padding.
- **Do** use iconography from a consistent, thin-stroke set (1.5px weight) to match the Inter typography.

### Don't
- **Don't** use pure black (#000000) for text. Use `on-surface` (#1b1c1c) for a softer, premium feel.
- **Don't** use standard "Material Design" shadows. They are too heavy for this editorial aesthetic.
- **Don't** use 1px dividers to separate content. Use a `16px` or `24px` gap instead.
- **Don't** cram data. If a table has more than 8 columns, implement a "Focus Mode" that hides secondary metadata.