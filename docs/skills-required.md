# Skills Required Audit - besu-digital-asset-demo

> Run: 2026-09-14 · Project: besu-digital-asset-demo

Reference: no `PROJECT.md` exists in this repo. Tech stack pulled from `docs/architecture.md` §9 and `docs/plan.md` §3 instead: TypeScript (strict), Node.js 20, Express, Solidity + Hardhat, ethers.js, Hyperledger Besu (QBFT), SQLite, React + Vite, Docker Compose, Playwright.

---

## Step 1 — Prune: Installed Skills

| Skill | Installed path | Assessment | Reason |
|---|---|---|---|
| agent-browser | `.claude/skills/agent-browser/` | Borderline | Browser automation CLI - useful for manual QA of the dashboard beyond Playwright, but not stack-specific |
| architecture | `.claude/skills/architecture/` | Relevant | Core grill-me toolkit doc generator, already used |
| brandkit | `.claude/skills/brandkit/` | Irrelevant | Premium brand-kit image generation - this project has no branding need |
| claude-api | `.agents/skills/claude-api/` | Irrelevant | Project does not use the Claude/Anthropic API anywhere |
| deliverables | `.claude/skills/deliverables/` | Relevant | Core grill-me toolkit doc generator, already used |
| design-doc-mermaid | `.claude/skills/design-doc-mermaid/` | Borderline | Diagram generation is adjacent to the Mermaid diagrams already hand-written inline in docs |
| design-taste-frontend | `.claude/skills/design-taste-frontend/` | Irrelevant | Premium visual-design direction - this is a functional admin dashboard, not a marketing/consumer surface |
| design-taste-frontend-v1 | `.claude/skills/design-taste-frontend-v1/` | Irrelevant | Same domain mismatch as above, older version |
| emil-design-eng | `.claude/skills/emil-design-eng/` | Irrelevant | UI polish philosophy for premium products - out of scope for a functional PoC |
| full-output-enforcement | `.claude/skills/full-output-enforcement/` | Relevant | Generic code-generation completeness utility, useful for large contract/backend files |
| gpt-taste | `.claude/skills/gpt-taste/` | Irrelevant | Awwwards-level design engineering - not needed for a functional dashboard |
| grill-me | `.claude/skills/grill-me/` | Relevant | Core grill-me toolkit, already used to drive this whole session |
| high-end-visual-design | `.claude/skills/high-end-visual-design/` | Irrelevant | Agency-tier visual-design directive - out of scope |
| image-to-code | `.claude/skills/image-to-code/` | Irrelevant | Design-reference-image-first workflow - not needed for a functional dashboard |
| imagegen-frontend-mobile | `.claude/skills/imagegen-frontend-mobile/` | Irrelevant | No mobile app in scope (PRD non-goals) |
| imagegen-frontend-web | `.claude/skills/imagegen-frontend-web/` | Irrelevant | No marketing landing page in scope |
| impeccable | `.claude/skills/impeccable/` | Irrelevant | Full-spectrum premium frontend design - domain mismatch for a functional PoC dashboard |
| industrial-brutalist-ui | `.claude/skills/industrial-brutalist-ui/` | Irrelevant | Aesthetic overlay - not needed |
| install-skill | `.agents/skills/install-skill/` | Relevant | Meta tool for installing future skills |
| minimalist-ui | `.claude/skills/minimalist-ui/` | Irrelevant | Aesthetic overlay - not needed |
| plan | `.claude/skills/plan/` | Relevant | Core grill-me toolkit doc generator, already used |
| playwright-e2e | `.claude/skills/playwright-e2e/` | Relevant | Directly matches D-13 (3 Playwright specs required for Phase 4 exit) |
| pr-review | `.claude/skills/pr-review/` | Relevant | Generic code-review utility, stack-agnostic |
| prd | `.claude/skills/prd/` | Relevant | Core grill-me toolkit doc generator, already used |
| q | `.claude/skills/q/` | Relevant | Quick session context loader, generic utility |
| redesign-existing-projects | `.claude/skills/redesign-existing-projects/` | Irrelevant | No existing site to redesign |
| security-review | `.agents/skills/security-review/` | Relevant | Matches the accepted-risk security concerns in architecture.md §10 (no auth on admin endpoints, key handling, R3/R5) |
| skill-creator | `.agents/skills/skill-creator/` | Relevant | Meta tool, not tied to any stack |
| skills-required | `.claude/skills/skills-required/` | Relevant | This skill itself |
| stitch-design-taste | `.claude/skills/stitch-design-taste/` | Irrelevant | Google Stitch design-system generator - not used |
| ui-ux-pro-max | `.claude/skills/ui-ux-pro-max/` | Irrelevant | Premium UI/UX style database - domain mismatch for a functional PoC dashboard |
| usecase | `.claude/skills/usecase/` | Relevant | Core grill-me toolkit doc generator, already used |

**16 skills flagged Irrelevant**, pending user confirmation before deletion: `brandkit`, `claude-api`, `design-taste-frontend`, `design-taste-frontend-v1`, `emil-design-eng`, `gpt-taste`, `high-end-visual-design`, `image-to-code`, `imagegen-frontend-mobile`, `imagegen-frontend-web`, `impeccable`, `industrial-brutalist-ui`, `minimalist-ui`, `redesign-existing-projects`, `stitch-design-taste`, `ui-ux-pro-max`.

---

## Step 2 — Suggest: Missing Skills

Searched the open skills registry (`npx skills find`) for Solidity/Hardhat/Ethereum, Express/Node backend, and Docker Compose. No result cleared the preferred 1K-install quality bar - the best matches are listed below with that caveat flagged explicitly.

| Priority | Skill | Why this project needs it | Install command |
|---|---|---|---|
| High | `bobmatnyc/claude-mpm-skills@nodejs-backend-typescript` (753 installs) | Directly matches the `backend-api` stack: Node.js + TypeScript strict, Express (D-09) | `npx skills add bobmatnyc/claude-mpm-skills@nodejs-backend-typescript -g -y` |
| High | `mindrally/skills@ethereum` (695 installs) | Directly matches Phase 2: Solidity contract development and Ethereum-family tooling for the T-REX suite (D-01, D-03) | `npx skills add mindrally/skills@ethereum -g -y` |
| Medium | `bagelhole/devops-security-agent-skills@docker-compose` (408 installs) | Matches the 4-container Docker Compose topology (architecture.md §1) | `npx skills add bagelhole/devops-security-agent-skills@docker-compose -g -y` |

**Caveat:** none of these reach the 1K-install bar this audit prefers (highest is 753). No well-known, high-install skill exists yet for Besu specifically or for ERC-3643/T-REX specifically - this is a narrow enough niche that the registry doesn't have a strong match. Treat these three as reasonable but unverified starting points, skim each one's content before relying on it, or proceed without them (the project's own `docs/architecture.md` and `docs/plan.md` already carry the load-bearing implementation guidance).

---

## Summary

Audited 32 installed skills (`.claude/skills/` + `.agents/skills/`, deduplicated) against the confirmed stack (TypeScript/Node/Express, Solidity/Hardhat, Besu, SQLite, React/Vite, Docker Compose, Playwright). 16 were flagged Irrelevant (all in the premium visual-design / brand / image-generation category - a mismatch for this functional engineering PoC); user confirmed deletion of all 16, removed via `git rm -r` from both `.claude/skills/` and `.agents/skills/` (staged, not yet committed). 2 are Borderline (`agent-browser`, `design-doc-mermaid`) and were kept without action. 14 are Relevant and kept as-is, including the full grill-me doc-generation toolkit already used this session, `playwright-e2e` (matches D-13), and `security-review` (matches the accepted key-handling/no-auth risks in architecture.md §10).

**Suggested skills - outcome:** user approved the two High-fit suggestions. `bobmatnyc/claude-mpm-skills@nodejs-backend-typescript` did not exist as a real slug in that repo (registry listing was stale) - substituted with the closer, actually-available match `bobmatnyc/claude-mpm-skills@express-production`, which directly covers the exact framework in use (D-09). `mindrally/skills@ethereum` installed as named - note its Snyk assessment came back **Med Risk** (vs Safe/Low for the other), which is a reasonable flag to keep in mind since installed skills run with full agent permissions; nothing else in its metadata suggested a specific concern. `bagelhole/devops-security-agent-skills@docker-compose` was not installed (user chose the two High-fit skills only, not the Medium-fit Docker Compose one). No high-install (1K+) skill exists yet for this project's most novel gap - Besu/ERC-3643 specific tooling - so this remains a gap best closed by reading official Besu/T-REX documentation directly rather than via an unverified low-install skill.
