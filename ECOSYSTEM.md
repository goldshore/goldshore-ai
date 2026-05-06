# GoldShore AI Ecosystem

## Vibe Coding & Human-in-the-Loop
This repository embodies the "Vibe Coding" philosophy, prioritizing rapid iteration, intuitive interfaces, and AI-assisted development. We believe in a **Human-in-the-Loop (HITL)** approach where automated agents (like Jules and Sentinel) handle routine tasks, hygiene, and security, allowing human engineers to focus on high-level architecture and creative problem-solving.

### Core Principles
1.  **AI Augmentation:** We integrate best-in-class AI models (Gemini, Claude, GPT-4) via our Gateway and Agent layers to provide intelligent features.
2.  **Resilience:** Infrastructure is built on Cloudflare Workers and Pages for edge-native performance and high availability.
3.  **Security:** Automated scanning (Frogbot, Sentinel) and zero-trust access policies ensure a secure environment.

## Tech Stack & Integrations

### Primary Infrastructure
*   **Cloudflare:** Workers (API, Gateway, Agent), Pages (Web, Admin), D1 (Database), R2 (Storage), KV (Cache).
*   **GitHub Actions:** CI/CD pipelines, automated PR reviews, and security scanning.
*   **TurboRepo:** High-performance build system for the monorepo.

### AI & Agents
*   **Jules (Bot):** Our internal automated engineer assistant. Handles PR hygiene, simple refactors, and repo maintenance.
*   **GoldShore Agent:** Autonomous service for background tasks and complex reasoning chains.
*   **Models:** Integrated support for Google Gemini, OpenAI GPT-4, and Anthropic Claude via Cloudflare AI Gateway.

### External Integrations (Planned/Supported)
*   **Alpaca:** Stock market data and trading API integration for financial dashboards.
*   **Thinkorswim:** Integration for advanced charting and trading analysis.
*   **Google Gemini:** Multimodal processing for content analysis and generation.
*   **ChatGPT:** Conversational interfaces and support bots.

## Utility Extensions
We recommend the following extensions/tools for maximizing productivity in this repo:
*   **GitHub Copilot:** For inline code suggestions.
*   **Cloudflare Wrangler:** For local development and deployment of workers.
*   **Biome/Prettier:** For consistent code formatting.
*   **Jules Extension:** (Internal) Use `apps/jules-bot` to trigger automated repository actions.

## Repository Structure
*   `apps/gs-web`: Public marketing site (Astro).
*   `apps/gs-admin`: Internal operations dashboard (Astro).
*   `apps/gs-gateway`: Edge gateway for routing, auth, and rate limiting (Worker).
*   `apps/gs-api`: Core business logic and data access (Worker).
*   `apps/goldshore-agent`: AI agent service (Worker).
*   `apps/gs-control`: Internal ops automation.

---
*Built with ❤️ by GoldShore Engineering.*
