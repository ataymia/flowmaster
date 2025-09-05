# 📞 FlowMaster — Call Center Assistant

## Overview
FlowMaster is a **one-stop call center tool** built for Allstar Services, Rapid Roofing, and Craftsmen Roofing & Exteriors.  
It streamlines agent workflows with guided call scripts, rebuttal libraries, SMS templates, compliance notes, and embedded tools — all in a modern, responsive UI.  

Agents no longer need to bounce between multiple tabs; FlowMaster centralizes everything in a single screen.

---

## 🔑 Key Features
- **Script Engine**
  - Inbound, Outbound, and Special-Case flows  
  - Service area checks (ex: 🚫 Detroit exclusion)  
  - Automatic step progression + completion tracking  
  - Yellow-highlighted internal notes/warnings (not to be read aloud)

- **Rebuttals**
  - Full-screen searchable reference with categories + color-coded badges  
  - Keyword search with term highlighting  
  - Copy-to-clipboard for easy reuse  

- **SMS Drawer**
  - Standard SMS templates with live-fill (brand, agent, customer, link)  
  - Compliance templates (STOP/opt-out)  
  - Same-day cancellation Teams template  
  - Keyword search with highlighting  
  - Copy-to-clipboard for filled replies  

- **Floating Tools**
  - 🤖 **Bot Dock** → Embeds `allstarbot.html` for live AI assistant (kept modular for updates)  
  - 🏠 **House Dock** → Google Programmable Search Engine (CSE) with integrated search bar and results panel (default to all results, toggle to images tab for property lookup)

- **UX & Accessibility**
  - Responsive dark theme with consistent UI  
  - ARIA live regions for screen readers  
  - Escape key closes drawers/docks  
  - Focus trap inside drawers for accessibility  
  - Persistent state via `localStorage` (fields + last script survive refresh)

---

## 🚀 Setup & Hosting
1. Place these files in the same folder:  
   - `FlowMaster.html` (current OG build)  
   - `allstarbot.html` (AI bot embed file)  

2. Start a local web server:
   ```bash
   python -m http.server 8080
   ```
   _(Requires Python 3 — included by default on most systems)_

3. Open in browser:
   ```
   http://localhost:8080/FlowMaster.html
   ```

4. Use Chrome or Edge for best compatibility.

---

## 🛠 Maintenance & Updates
- **Scripts**: Updated centrally inside the FlowMaster HTML file.  
- **Bot**: Self-contained (`allstarbot.html`). Updating this file automatically updates the 🤖 dock in FlowMaster.  
- **CSE (🏠)**: Controlled via Google Programmable Search Engine dashboard. Changes to allowed sites/appearance propagate immediately.  
- **Rebuttals & Templates**: Growing library — future AI integration will add entries automatically.  

---

## 📌 Notes
- FlowMaster is dark-themed for long-shift comfort. Non-customer-facing notes appear in **yellow** so agents know not to read them aloud.  
- The app is currently **rolled out at V2**, with AI features in experimental phases.  
- Future phases (AI-driven auto-rebuttals, smart SMS suggestions, etc.) will be layered **only after testing** — OG rollout versions remain frozen until explicitly updated.  
