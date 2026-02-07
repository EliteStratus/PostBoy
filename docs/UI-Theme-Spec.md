# PostBoy UI Theme Spec — Light & Dark Toggle

> **Purpose:** Define the official theming approach for PostBoy UI.
> This spec is written for direct handoff to **Cursor** and frontend implementation.
>
> **Decision:** Support **exactly two UI themes** — **Light** and **Dark** — toggled via an icon.
> No additional UI themes are supported in v1.

---

## 1. Design Principles

- Theme switching must be **instant** (no reload).
- UI themes are **separate from editor themes** (Monaco handles editor syntax).
- Theming must be token-based to avoid duplication.
- Accessibility (contrast, focus states) must be preserved in both modes.

---

## 2. Supported Themes

### UI Themes (v1)
- **Light**
- **Dark**

### Explicitly Out of Scope (v1)
- Solarized / Nord / Dracula
- High-contrast variants
- User-defined color themes

---

## 3. Default Theme Behavior

On first load:
1. Detect OS preference via `prefers-color-scheme`
2. If `dark`, default to **Dark**
3. Otherwise default to **Light**

User selection:
- Overrides OS preference
- Persisted locally (e.g., `localStorage` or IndexedDB)
- No server-side persistence

---

## 4. Theme Toggle UI

### Control Type
- **Icon-only toggle**
- Sun / Moon metaphor

### Icons
- ☀️ Sun → switch to Light
- 🌙 Moon → switch to Dark

### Placement
- Top-right corner of app header
- Or inside a settings menu (1 click away max)

### Behavior
- Clicking toggles between Light ↔ Dark
- Tooltip on hover:
  - “Switch to Light theme”
  - “Switch to Dark theme”

---

## 5. Theming Architecture (Required)

### Token-based system
All UI colors must reference semantic tokens, **not raw hex values**.

Example tokens:
- `--bg-app`
- `--bg-surface`
- `--bg-sidebar`
- `--border-default`
- `--text-primary`
- `--text-secondary`
- `--accent-primary`
- `--accent-success`
- `--accent-warning`
- `--accent-error`

Themes override token values only.

---

## 6. Light Theme (Reference)

Light theme uses the **PostBoy Light (Neutral + Teal)** palette.

Key intent:
- Bright, calm, low eye fatigue
- Neutral backgrounds
- Teal as primary accent

(Exact colors defined in `POSTBOY_UI_COLORS.md`)

---

## 7. Dark Theme (Guidelines)

Dark theme is **not an inversion** of Light.
It must be designed intentionally.

### Dark Theme Principles
- Dark gray backgrounds (not pure black)
- Reduced contrast for large surfaces
- High contrast for text and focus states
- Accent colors reused from Light theme where possible

### Example semantic mapping (illustrative)
- `--bg-app`: dark slate / charcoal
- `--bg-surface`: slightly lighter than app bg
- `--text-primary`: near-white
- `--text-secondary`: muted gray
- `--accent-primary`: same teal as Light

Exact color values may be defined in a separate Dark theme spec.

---

## 8. Accessibility Requirements

- Text contrast must meet WCAG AA
- Focus rings must be visible in both themes
- Success / Attention / Failed states must not rely on color alone
- Icons + labels must remain legible

---

## 9. Persistence & Storage

- Store theme preference locally only
- Recommended key:
  - `postboy.ui.theme = "light" | "dark"`
- No cookies required
- No backend involvement

---

## 10. Editor (Monaco) Theme Handling

- Editor theme selection is **independent** of UI theme
- Default mapping:
  - UI Light → Monaco Light
  - UI Dark → Monaco Dark
- Allow editor theme override later without affecting UI theme

---

## 11. Acceptance Criteria

- [ ] App defaults correctly based on OS preference
- [ ] User can toggle theme with one click
- [ ] Choice persists across reloads
- [ ] No UI element uses hardcoded colors
- [ ] Light and Dark are visually distinct but consistent
- [ ] UI remains readable after extended use

---

## 12. Non-Goals

- No per-component theme overrides
- No theme marketplace
- No user-defined palettes

---

## 13. Summary (Authoritative)

> PostBoy supports **exactly two UI themes**: **Light** and **Dark**.
> Theme switching is icon-based, instant, local-only, and token-driven.
> This decision is final for v1.

---
