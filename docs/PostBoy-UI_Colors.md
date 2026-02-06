# PostBoy UI Color Spec — Option 1 (Light Neutral + Dark Green)

> **Purpose:** Define the canonical color system for PostBoy Web UI.
> This spec is optimized for long developer sessions, clarity, and a professional feel.
> Intended for direct use by Cursor and frontend implementation.

---

## 1. Design Goals

- Low eye fatigue for long debugging sessions
- Clear visual hierarchy (actions > content > chrome)
- Neutral base that does not compete with JSON/code syntax colors
- Distinct from Postman while remaining familiar to developers

---

## 2. Core Brand Colors

### Primary (Actions, Highlights)
- **Primary:** `#15803D`
- **Primary Hover:** `#14532D`
- **Primary Active:** `#0F5132`
- **Primary Soft (backgrounds):** `#DCFCE7`

Used for:
- Send button
- Active request
- Selected collection/folder
- Primary CTAs

---

## 3. Semantic Colors

| Purpose  | Color |
|--------|-------|
| Success | `#22C55E` |
| Warning | `#F59E0B` |
| Error   | `#EF4444` |
| Info    | `#38BDF8` |

---

## 4. Background & Surface Colors

| Element | Color |
|-------|-------|
| App Background | `#F8FAFC` |
| Panels / Cards | `#FFFFFF` |
| Sidebar Background | `#F1F5F9` |
| Secondary Surface | `#E2E8F0` |
| Dividers / Borders | `#E5E7EB` |

Rules:
- Never use pure white for the entire screen
- Sidebar should feel slightly recessed
- Panels should float subtly above the background

---

## 5. Typography Colors

| Usage | Color |
|-----|-------|
| Primary Text | `#0F172A` |
| Secondary Text | `#475569` |
| Muted Text | `#94A3B8` |
| Disabled Text | `#CBD5E1` |

---

## 6. Buttons

### Primary Button (Send)
- Background: `#15803D`
- Text: `#FFFFFF`
- Hover: `#14532D`
- Disabled: `#86EFAC`

### Secondary Button
- Background: `#FFFFFF`
- Border: `#CBD5E1`
- Text: `#0F172A`
- Hover Background: `#F1F5F9`

---

## 7. Sidebar (Collections Tree)

- Background: `#F1F5F9`
- Folder icon: `#64748B`
- Request text: `#0F172A`
- Active item background: `#DCFCE7`
- Active item text: `#0F5132`

### HTTP Method Badges
| Method | Color |
|------|-------|
| GET | `#38BDF8` |
| POST | `#22C55E` |
| PUT | `#F59E0B` |
| PATCH | `#A78BFA` |
| DELETE | `#EF4444` |

Badges should be:
- Small
- Rounded
- Low-saturation

---

## 8. Request Builder

- Input background: `#FFFFFF`
- Input border: `#CBD5E1`
- Focus ring: `#15803D`
- Placeholder text: `#94A3B8`

---

## 9. Script Editors (Pre / Post)

- Editor background: `#FFFFFF`
- Border: `#CBD5E1`
- Header strip background: `#F1F5F9`
- Header text: `#475569`

Editor must feel visually distinct from request config.

---

## 10. Response Panel

### Status Colors
| Status | Color |
|------|-------|
| 2xx | `#22C55E` |
| 3xx | `#38BDF8` |
| 4xx | `#F59E0B` |
| 5xx | `#EF4444` |

- Status pill should be subtle, not loud
- Response body background stays white

---

## 11. Tailwind Token Mapping (Recommended)

```ts
colors: {
  primary: {
    DEFAULT: '#15803D',
    hover: '#14532D',
    active: '#0F5132',
    soft: '#DCFCE7',
  },
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#38BDF8',
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  sidebar: '#F1F5F9',
  border: '#E5E7EB',
  text: {
    primary: '#0F172A',
    secondary: '#475569',
    muted: '#94A3B8',
  }
}
```

---

## 12. Dark Mode (Future)

- Not part of Option 1
- Keep all colors tokenized to enable dark mode later without refactor

---

## 13. Acceptance Checklist

- [ ] Send button is visually dominant
- [ ] Sidebar does not overpower main content
- [ ] Active request is obvious without being loud
- [ ] Code/JSON colors are not overridden by theme
- [ ] UI remains readable after 6+ hours of use

---
