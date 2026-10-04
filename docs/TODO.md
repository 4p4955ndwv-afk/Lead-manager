# Lead Manager To-Do

The build checklist for the plan in [`docs/blueprint.html`](blueprint.html). Each task has an ID, an owner
(**Organisation** = only the client organisation can do it, **Builder** = build work, **Both**), an effort
(S ≤ half a day, M 1–3 days, L > 3 days), its prerequisites and a "done when" check. ⚑ marks the critical path.

**279 tasks** · P0: 46 · P1: 46 · P2: 76 · P3: 46 · P4: 37 · P5: 23 · Ongoing: 5

## Start this week

- [ ] **P0-03** Sign a standalone NDA before the builder gets any access — Sign a standard mutual NDA on day 1 so the builder can be invited to the vault and vendor accounts this week.
- [ ] **P0-01** Hold the kickoff: get written answers to Q1-Q9 and approval of the blueprint and architecture — Q1 (country), Q2 (procedure type) and Q8 (admin access) block most of P0; start the 5-working-day clock for answers or recorded defaults.
- [ ] **P0-02** Make the GitHub repository private and block client data from it — The repo is public under a personal account today and must be private before any organisation-specific file is committed.
- [ ] **P0-04** Decide the operating model and who owns each vendor account — The operating model decides who owns Cloudflare, Anthropic and GitHub. It no longer waits for the 5-day answer window: decide it at the kickoff so P0-10 and P0-11 can start this week.
- [ ] **P0-06** Appoint the privacy lead, clinical sign-off owner, legal reviewer and playbook owner — The privacy lead, clinician and legal reviewer sign the scope memo, privacy notice, claims list and playbook, so every legal task waits on them.
- [ ] **P0-09** Set up the password manager, shared admin mailbox and private account register — Every vendor login uses the vault and admin alias, and the Instagram audit can't start without them.
- [ ] **P0-22** Audit the Instagram account: professional type, people with access, 2FA and message settings — This is the first link in the Meta chain (portfolio, Business Verification, App Review), and scrapers or private-API tools risk a ban today.
- [ ] **P0-23** Confirm or create the Meta Business portfolio in the organisation's legal name — Business Verification is submitted from the portfolio, so it has to exist in the legal name first.
- [ ] **P0-24** Submit Meta Business Verification in week 1 — Business Verification is the longest-lead item on the path to Instagram and Meta controls its pace; submit in week 1. If "Start verification" is greyed out, first create the bare Business-type Meta app owned by the portfolio; Meta usually enables verification only once an app or WhatsApp account is connected.
- [ ] **P0-27** Check TikTok eligibility and set up TikTok Business Center — The TikTok registration country decides between the direct API, a partner or manual mode, and an eligible account should apply in weeks 1-2.
- [ ] **P0-11** Create the Anthropic Console organisation with staging, production and history-analysis workspaces — The Anthropic org must exist so the DPA (and a BAA request if US clients) is in place before any client data reaches Claude.
- [ ] **P0-10** Create the Cloudflare account with two admins, a least-privilege builder and the Workers Paid plan — Cloudflare hosts everything; the Paid plan and correct ownership are needed before IaC, the export bucket and the gateway.
- [ ] **P0-21** Publish an interim privacy notice v0, terms and data-deletion instructions on the organisation's website — The Meta app settings, App Review and the TikTok application all need a live privacy URL.
- [ ] **P0-40** Inventory the accounts, staff names and non-lead handles the DM history covers — Exporters must be named and the staff roster collected before exports are requested and before masking and lint can be built.
- [ ] **P0-32** Supply the approved procedure catalogue and price list — The signed price list feeds the claims list, Playbook v0, get_price and the lint, all on the shadow-mode path.
- [ ] **P0-36** Scaffold the minimal TypeScript monorepo — The builder can start the monorepo skeleton now without any client data or open answers.
- [ ] **P0-33** Supply the current FAQs, saved replies and call scripts — No dependencies: staff can export saved replies, FAQ documents and call scripts now. Playbook v0 and the eval set are built from them.

## Decisions needed from the organisation

- **Q1: In which country are the organisation and its TikTok account registered, and where are clients located?** Decides GDPR/UK GDPR vs HIPAA, data residency and the Claude route, TikTok API eligibility (EEA/UK/CH blocked), advertising and under-18 rules, SMS sender rules and breach deadlines. _Blocks: P0-12, P0-13, P0-16, P0-17, P0-18, P0-20, P0-21, P0-24, P0-27, P0-28, P0-29, P0-31, P0-34, P0-38, P1-09, P1-11, P1-26, P1-27, P1-28, P1-31, P1-35, P1-39, P1-40, P1-41, P1-42, P1-43, P1-45, P2-28, P2-29, P2-38, P2-39, P2-47, P2-64, P2-69, P2-70, P2-71, P2-72, P3-22, P3-29, P3-30, P3-34, P3-35, P3-44, P3-45, P3-46, P4-06, P4-09, P4-11, P4-13, P4-14, P4-17, P4-32, P4-35, P5-02, P5-06, P5-07, P5-08_
- **Q2: What procedures does the organisation offer (medical, cosmetic, dental, hair, other)?** Sets whether data is health data, which prescription-only medicine and claims rules apply, minimum ages, clinician sign-off scope, consent forms and the treatment-plan model. _Blocks: P0-12, P0-13, P0-17, P0-20, P0-21, P0-32, P1-16, P1-25, P1-26, P1-27, P1-30, P1-31, P1-32, P1-34, P1-35, P1-37, P1-40, P1-41, P1-42, P1-43, P1-44, P2-38, P2-39, P2-45, P2-71, P3-43, P3-44, P3-45, P4-01, P4-02, P4-06, P4-07, P4-08, P4-09, P4-11, P5-07_
- **Q3: Which records show which past DM leads converted (bookings, clinic software, payments, call logs)?** Outcome labels drive the history analysis and Playbook v1; thin records trigger staff labelling or proxy labels. _Blocks: P0-20, P0-46, P1-12, P1-13, P1-14, P1-15, P1-20, P1-38, P2-61, P5-03_
- **Q4: How many DMs arrive per day, and how many staff are there in which roles?** Sizes budgets, spend caps and load tests, the rota and SLA ladder, role templates, training, and device and MCP seat counts. _Blocks: P0-07, P0-29, P0-31, P1-24, P1-29, P1-42, P2-01, P2-15, P2-16, P2-44, P2-45, P2-59, P2-72, P3-02, P3-04, P3-12, P3-13, P3-14, P3-18, P3-23, P3-24, P3-25, P4-10, P4-28, P4-31, P4-32, P4-36, P5-02_
- **Q5: Which tools are in use today (calendar, clinic software, payments, WhatsApp Business, spreadsheets)?** Decides integrate vs replace, migration sources, existing WhatsApp numbers and automations to switch off, and processor contracts. _Blocks: P0-14, P0-31, P0-46, P1-12, P1-39, P1-45, P1-46, P2-28, P2-68, P2-69, P2-70, P3-01, P3-12, P3-19, P3-20, P3-45, P4-01, P4-02, P4-03, P4-05, P4-12, P4-15, P4-17, P4-20, P4-36, P4-37, P5-06_
- **Q6: What is the payment model (deposits, packages, instalments) and which provider?** Shapes payment wording in the playbook, the price list, money policies, the ledger and instalments, and consumer-credit and cancellation checks. _Blocks: P0-14, P0-32, P0-46, P2-34, P3-12, P3-45, P4-01, P4-08, P4-12, P4-13, P4-14, P4-15, P4-16, P4-18, P4-20, P4-36, P4-37_
- **Q7: Which languages do DMs arrive in?** Every approved string (disclosure, escalation, minors, banned phrases, templates), the masking audit, eval coverage and language routing must exist per language. _Blocks: P1-09, P1-10, P1-16, P1-22, P1-26, P1-27, P1-28, P1-29, P1-32, P1-33, P1-34, P1-35, P1-36, P1-38, P1-41, P2-28, P2-29, P2-47, P2-62, P2-65, P3-25, P3-36, P3-38, P4-16, P4-17, P5-07, P5-08_
- **Q8: Which business accounts exist, and who has admin access to the Meta Business portfolio and TikTok Business Center?** Without admin access nothing on the Instagram path can start: account audit, portfolio, Business Verification, Meta app, App Review and exports. _Blocks: P0-22, P0-23, P0-24, P0-25, P0-26, P0-27, P0-28, P0-29, P0-30, P0-40, P0-43, P0-44, P2-52, P2-53, P2-54, P2-55, P3-01, P3-15, P3-26, P3-29, P3-30, P3-34, P3-35_
- **Q9: Is the organisation OK starting in shadow and then co-pilot mode for 2-4 weeks before autopilot?** Sets the gate criteria and timeline; working back from App Review approval (~week 7), autopilot realistically lands in weeks 11-13 instead of week 10. _Blocks: P0-30, P2-01, P2-57, P3-09, P3-11, P3-25, P3-26, P3-27, P3-39, P3-40_
- **Operating model: will an operator own the multi-tenant platform (Cloudflare, Anthropic, GitHub), or will each organisation get its own deployment?** This must be decided before any platform account is created. Otherwise organisation 2's data could end up in organisation 1's accounts, and code ownership and reuse stay unclear. _Blocks: P0-04, P0-05, P0-10, P0-11, P0-16, P0-18, P0-37, P5-16_
- **Where may health data live: is HIPAA in scope, which D1/R2 jurisdiction applies, and is first-party Claude inference acceptable or must it run in an EU region via Vertex AI or Bedrock?** R2 jurisdiction is fixed when a bucket is created and HIPAA needs a Cloudflare Enterprise BAA, so this decision has to come before any personal data is stored. Anthropic HIPAA readiness is organisation-wide and permanent and blocks the Batch API; first-party Claude inference runs in the US or globally only; the Vertex AI or Bedrock EU route has no Anthropic Batch endpoint or server-side fallbacks (verify). _Blocks: P0-17, P0-18, P0-38, P2-02, P4-01, P4-11_
- **Should comment-to-DM (instagram_business_manage_comments) and the HUMAN_AGENT tag be requested in the first App Review?** Adding them later needs a second review, and leaving them out removes comment handling from P3. _Blocks: P0-25, P2-53, P3-37_
- **Which TikTok route (direct API, partner, or manual), and what date triggers the fallback?** Partners cannot get around the EEA/UK/CH block. The chosen route decides what is built and paid for. _Blocks: P0-29, P3-29, P3-30, P3-32, P3-34, P3-35_
- **What is the Instagram contingency trigger date, and which fallback applies if Business Verification or App Review slips?** If this is agreed in week 1, a slip costs days instead of weeks. _Blocks: P0-30, P2-51_
- **Should WhatsApp use a new dedicated number or migrate the existing WhatsApp Business app number?** Migration and coexistence rules affect current use, and staff alerts in P2 depend on it. _Blocks: P1-46, P2-69, P4-16_
- **Which coordinator calling setup will be used, and which public number does the AI give out?** Clients must recognise the callback and never see personal numbers. The AI's handoff wording depends on this. _Blocks: P0-31, P2-47, P3-12_
- **What exactly goes into the co-pilot MVP scope, and what moves to P4/P5?** Without a freeze, P2 holds over 70 builder tasks and the week-9 co-pilot date slips. _Blocks: P2-01_
- **What numeric thresholds apply to the shadow-to-co-pilot and co-pilot-to-autopilot gates?** Fixing them before shadow starts stops the targets moving once data arrives. _Blocks: P2-57, P3-11, P3-39, P3-40_
- **Which model and effort per route, and what monthly AI budget (Opus 5.5 by default; Sonnet 5.5 only if the owner trades quality for cost)?** This sets cost per reply, spend caps and the history batch budget. _Blocks: P0-07, P1-17, P2-59_
- **Will staff use company or personal phones, and will apps be distributed via MDM or redemption codes?** This sets the device policy, clinical photo capture, remote-wipe ability and native app distribution. _Blocks: P2-72, P4-10, P4-32, P5-02_
- **Should calls be recorded (off by default)?** Recording needs notices, consent checks and retention rules, and it changes the SOP. _Blocks: P2-70, P3-12_
- **What are the deposit, cancellation, no-show, refund and instalment policies?** These policies drive payment wording, distance-contract and consumer-credit checks, and the ledger. _Blocks: P3-45, P4-12, P4-13, P4-14, P4-18_
- **Should existing clinic tools and the calendar be integrated or replaced?** This decides the migration scope and whether calendar sync or a double-entry rule is built. _Blocks: P0-46, P3-19, P4-05, P4-37_
- **Should an external pen test be commissioned before go-live?** Budget and timing must be known before the security review is signed. _Blocks: P3-17_
- **May testimonials and before/after photos be used in DMs or marketing?** Until the policy is approved the AI shares none. This affects the playbook and later retention work. _Blocks: P1-43, P1-34, P5-07_
- **Cloudflare plan: does the owner accept Workers Paid ($5/month plus metered R2, D1 and Queues usage) instead of the free tier the request asked for?** The free plan's per-request CPU limit, 24-hour queue retention and lack of Containers block password hashing, the reply tool loop and multi-GB history processing. _Blocks: P0-10_

## Critical path to Instagram autopilot

P0-01 → P0-03 → P0-09 → P0-23 → P0-24 → P0-06 → P0-04 → P0-21 → P0-25 → P0-13 → P0-10 → P0-11 → P0-12 → P0-17 → P0-18 → P0-36 → P0-37 → P0-38 → P1-01 → P2-02 → P2-03 → P2-05 → P2-06 → P2-20 → P2-22 → P2-23 → P2-24 → P2-25 → P2-26 → P2-33 → P2-07 → P2-52 → P2-53 → P2-54 → P2-55 → P0-32 → P1-25 → P1-26 → P1-28 → P0-33 → P1-32 → P1-34 → P2-28 → P2-29 → P2-30 → P2-35 → P2-38 → P2-56 → P2-57 → P1-42 → P2-67 → P3-09 → P3-11 → P2-50 → P2-51 → P3-24 → P3-25 → P3-26 → P3-27 → P3-08 → P3-39 → P3-40

## P0 · Approvals, accounts and exports (1-3)

Exit criteria:

- Mutual NDA signed before the builder receives any access
- Q1-Q9 answered or replaced by an approved default; blueprint, architecture and operating model approved in writing
- GitHub repo private; vault and admin alias, Cloudflare (Workers Paid, accepted in writing by the owner in place of the requested free tier) and Anthropic org exist with two org admins; Anthropic DPA executed; if US clients, the HIPAA-readiness decision is recorded (organisation-wide, permanent, blocks the Batch API)
- Meta Business Verification submitted in week 1; production and staging Meta apps created; privacy notice v0, terms and data-deletion pages live
- TikTok eligibility known and the API applied for, or manual route recorded
- Hosting/residency and tenancy ADRs approved; scaffold, minimal CI and IaC deploy to staging in the chosen jurisdiction
- Every DM export and outcome file is in private R2 with matching checksums; price list signed

- [ ] **P0-01** ⚑ Hold the kickoff: get written answers to Q1-Q9 and approval of the blueprint and architecture  
  _Both · Launch & operations · effort S · needs Q1, Q2, Q3, Q4, Q5, Q6, Q7, Q8, Q9_  
  Walk the owner through docs/blueprint.html and the nine open questions, collecting evidence (e.g. a screenshot of the TikTok account's registration country, staff roster size, tool list). Set a 5-working-day deadline; any question still open gets a recorded default assumption (e.g. UK/EEA rules apply, Instagram first, co-pilot first) so P0 does not stall.  
  **Done when:** A dated decision record in the organisation's document store holds an answer or approved default for each of Q1-Q9, and the owner has approved the blueprint and architecture (or a listed set of changes) in writing.
- [ ] **P0-02** ⚑ Make the GitHub repository private and block client data from it  
  _Both · Accounts & approvals · effort S_  
  github.com/4p4955ndwv-afk/Lead-manager is public under a personal account (checked 2026-10-03); make it private before anything organisation-specific is committed. Add a GitHub Action that rejects phone numbers, emails and blocked docs paths; registers, DPIA, access matrices, conversations, coverage reports and eval data live only in the organisation's document store or private R2.  
  **Done when:** The GitHub API reports the repo as private, and a test PR adding a phone number or a file under a blocked path fails the check.
- [ ] **P0-03** ⚑ Sign a standalone NDA before the builder gets any access  
  _Both · Legal & compliance · effort S_  
  Use a short standard mutual NDA covering credentials, DM exports, health data and business information, so it can be signed on day 1. The builder invitations in P0-09, P0-10, P0-11 and P0-23 can then go ahead in week 1 without waiting for the full build and support agreement (P0-05), which later incorporates it.  
  **Done when:** Both parties have signed the NDA and it is filed in the organisation's records before the builder is invited to the vault or any vendor account.
- [ ] **P0-04** ⚑ Decide the operating model and who owns each vendor account  
  _Both · Legal & compliance · effort S_  
  Before platform accounts are created, choose between an operator-owned multi-tenant platform (operator holds Cloudflare, Anthropic and GitHub; each organisation holds its own Meta, TikTok, WhatsApp and payment accounts and signs a DPA with the operator) or a separate deployment owned by each organisation. The choice also settles who owns the code and whether it may be reused for other organisations.  
  **Done when:** A signed decision record names the owner of each account class and of the code, and every account task references it.
- [ ] **P0-05** ⚑ Sign the build and support agreement (scope, fees, IP licence, NDA, support hours)  
  _Both · Legal & compliance · effort M · after P0-04_  
  Cover phases and acceptance criteria, fees and milestones, code ownership and reuse licence per P0-04, an NDA covering DM exports and health data, support and on-call hours with defect SLAs, a liability cap, and exit/handover terms. It sits alongside the Art. 28 DPA (P0-16), not instead of it.  
  **Done when:** The signed agreement is filed in the organisation's records, incorporates or supersedes the NDA from NEW-1, and is in force before any DM export is uploaded (P0-45).
- [ ] **P0-06** ⚑ Appoint the privacy lead, clinical sign-off owner, legal reviewer and playbook owner  
  _Organisation · Legal & compliance · effort S_  
  Name one person accountable for data protection, a registered clinician for clinical sign-off, the lawyer or consultant who reviews legal texts, and the person who decides playbook changes. They approve most P0-P1 documents, so appoint them in week 1.  
  **Done when:** Names, contacts and the clinician's registration number are in the compliance register.
- [ ] **P0-07** ⚑ Approve the one-off and monthly budget and map it to spend caps  
  _Both · Launch & operations · effort S · after P0-01 · needs Q4, Q5, Q6_  
  List every cost line: Cloudflare, Claude (history batch, replies, call briefs, scheduled jobs), SMS and WhatsApp per message, email provider, password manager, TikTok partner seats if used, Apple/Google fees and MDM, Claude seats for MCP users, legal review and an optional external pen test. Each recurring line becomes a provider spend limit or alert.  
  **Done when:** An owner-signed budget sheet exists and the account register records a spend cap or alert for every recurring line.
- [ ] **P0-08** ⚑ Load this task list into a tracker and run a weekly status and decision log  
  _Both · Launch & operations · effort S · after P0-02, P0-01_  
  Create one GitHub Projects item per task (no client data) with owner, phase, target week and dependencies, and mark the critical path. Hold a 30-minute weekly check with the owner on blockers, Meta/TikTok review status and pending decisions.  
  **Done when:** Every task is in the tracker with an owner and target week, and a weekly status entry exists for each week from week 2.
- [ ] **P0-09** ⚑ Set up the password manager, shared admin mailbox and private account register  
  _Both · Accounts & approvals · effort S · after P0-03_  
  The organisation buys a business password manager with two admins (2FA, offline recovery kit), invites the builder only to a 'Lead Manager' vault, and creates an alias such as platforms@<domain> reaching both admins for every vendor login. The account register (owner, two admins, builder role, 2FA, billing, renewal, recovery route) lives in the vault or a private org document, never in the repo.  
  **Done when:** Two admins with 2FA run the vault, the builder sees only the Lead Manager vault, a test mail to the alias reaches both admins, and the register template exists.
- [ ] **P0-10** ⚑ Create the Cloudflare account with two admins, a least-privilege builder and the Workers Paid plan  
  _Both · Accounts & approvals · effort S · after P0-04, P0-09_  
  Create it under the owner chosen in P0-04 using the admin alias, enforce passkey or TOTP 2FA, add a second super admin and invite the builder with the narrowest roles covering Workers, D1, R2, Queues, Durable Objects, DNS and Zero Trust. The request asked for free Cloudflare hosting: Queues, SQLite-backed Durable Objects and Cron Triggers exist on the Free plan, but the free plan's 10 ms CPU per request is too tight for password hashing and the reply tool loop, Queues keep messages only 24 h, and Containers for multi-GB exports need Paid (verify current limits). Give the owner a one-page note on why the $5/month Workers Paid plan is needed, what is metered beyond the allowances (R2 storage for exports and backups, D1, Queues) and what stays free (Cloudflare Access up to 50 users); with written acceptance, enable Paid, add it to the P0-07 budget, set usage alerts and confirm the self-serve DPA covers the account.  
  **Done when:** The account shows 2 admins with 2FA and the builder on scoped roles, the owner's written acceptance of Workers Paid in place of the requested free tier is filed with the budget, the Paid plan is active with a billing alert, and DPA status is in the register.
- [ ] **P0-11** ⚑ Create the Anthropic Console organisation with staging, production and history-analysis workspaces  
  _Both · Accounts & approvals · effort S · after P0-04, P0-09_  
  Sign up with the admin alias under the legal owner chosen in P0-04, add billing, invite the backup admin and invite the builder at a non-admin developer role (verify role names). Separate workspaces keep keys, spend and logs apart.  
  **Done when:** The Console org has 2 admins, the builder at a non-admin role, active billing and the 3 workspaces.
- [ ] **P0-12** ⚑ Put Anthropic's DPA in place (and request a BAA if HIPAA may apply) before any client data is sent  
  _Both · Legal & compliance · effort S · after P0-11 · needs Q1, Q2_  
  Confirm the account is on commercial terms with the DPA and record the verified retention and training terms (Batch results are kept 29 days) and the inference_geo options. If Q1 suggests US clients, decide on HIPAA readiness in week 1: accepting the BAA in Console applies to the whole organisation permanently and makes the API reject non-eligible features with a 400, including the Batch API, Files API and MCP connector (checked 2026-10-03; verify). If enabled, run every Batch job (P1-17 to P1-19, P2-56, P3-08, P5-09) on the Messages API at about twice the cost, or use a separate non-HIPAA organisation only for data counsel confirms is de-identified; keep PHI out of JSON schemas.  
  **Done when:** The executed DPA (and BAA if needed) is filed, covered features and the date checked are in the register, and the owner's go-ahead for sending masked history is recorded.
- [ ] **P0-13** ⚑ Write the regulatory scope memo and complete any DPO or registration duties  
  _Both · Legal & compliance · effort M · after P0-01, P0-06 · needs Q1, Q2_  
  List each regime that applies and why: GDPR/UK GDPR, HIPAA and US state privacy and bot laws, PECR/TCPA, EU AI Act Art. 50, advertising codes (e.g. CAP/ASA and prescription-only medicine rules), under-18 restrictions, and healthcare-provider rules (provider registration such as CQC, cosmetic licensing schemes, face-to-face consultation before prescription-only treatments, clinical record-keeping). Decide whether a DPO is mandatory, whether an Art. 27 EU or UK representative is needed (an organisation established outside the EU/UK that offers services to clients there), and whether a data-protection registration or fee (e.g. ICO) is due, and register or appoint if so.  
  **Done when:** The memo in the organisation's document store marks each regime 'confirmed' or 'verify with counsel', the privacy lead has approved it, and proof of any required registration is filed.
- [ ] **P0-14** ⚑ Map controller and processor roles and build the sub-processor register  
  _Both · Legal & compliance · effort S · after P0-04, P0-13 · needs Q5, Q6_  
  With the privacy lead deciding the roles, list every vendor with purpose, data categories, location, transfer mechanism and contract status: Anthropic, Cloudflare, SMS/WhatsApp/email/push providers, payment provider, telephony, error tracking, GitHub if it ever touches client data, and respond.io or SleekFlow if used. Record Meta and TikTok as platforms whose terms the organisation accepts, verifying their role with counsel.  
  **Done when:** The register has one row per vendor with location, transfer mechanism and contract status, reviewed by the privacy lead.
- [ ] **P0-15** Make API or MCP access a pass/fail criterion for every tool and keep a Claude-access matrix  
  _Both · Accounts & approvals · effort S · after P0-14 · needs Q5_  
  The request says every tool and AI system must be reachable by Claude through an API or MCP so Claude can monitor and act. Add that as a pass/fail criterion to every vendor choice (SMS P1-45, email P2-05, telephony P0-31, TikTok partner P0-29, payments P3-45, transcription P3-36, calendar or clinic software P4-05, push and app stores). Keep a matrix in the account register: tool, route (official Claude connector, vendor MCP server, REST API, or a bridge through our own API or n8n), what Claude may read or do, credential scope and owner. Add existing tools from the P0-46 inventory when it lands.  
  **Done when:** The matrix covers every tool and AI system in the register with a verified route, the vendor-selection tasks cite it, and any tool without a route has an approved bridge or an owner-signed exception.
- [ ] **P0-16** ⚑ Sign the controller-processor DPA, or record that the organisation operates every account itself  
  _Both · Legal & compliance · effort S · after P0-04, P0-14 · needs Q1_  
  If an operator runs the platform (P0-04), sign an Art. 28-style DPA covering instructions, confidentiality, security, sub-processor approval and change notice, help with DSARs, DPIAs and breaches, and deletion or return of data at the end.  
  **Done when:** A signed DPA, or a written sole-operator record, is filed with the account-ownership list.
- [ ] **P0-17** ⚑ Decide where health data may live and record it as an ADR (HIPAA path, D1/R2 jurisdiction, transfers, Claude route)  
  _Both · Legal & compliance · effort M · after P0-10, P0-12, P0-13 · needs Q1, Q2_  
  If HIPAA applies, Cloudflare signs BAAs only on Enterprise, so get a quote or keep clinical fields in a BAA-covered store, enable Anthropic HIPAA readiness (P0-12) and run a HIPAA risk analysis. Pick the D1 location and R2 jurisdiction (e.g. EU) before any bucket holds personal data, since R2 jurisdiction is fixed at bucket creation (verify), and record SCC/UK-addendum transfers. First-party Claude offers inference_geo 'us' or 'global' only, with workspace data stored in the US (checked 2026-10-03); if EU-only processing is required, evaluate Vertex AI or Bedrock EU regions, where the cloud provider is the processor and Anthropic's Batch endpoint, server-side fallbacks and inference_geo are unavailable (verify per region).  
  **Done when:** docs/adr/0002-data-hosting.md names the plan, each store's location, where clinical fields live and the Claude route, approved in writing by the owner and privacy lead.
- [ ] **P0-18** ⚑ Decide the tenancy model (shared D1 with org_id vs per-organisation databases and buckets)  
  _Builder · Core platform · effort S · after P0-04, P0-17 · needs Q1_  
  Weigh D1's per-database size limit (verify), organisations needing different jurisdictions, per-org export and deletion, migrations across many databases, and blast radius. It shapes the schema, TenantContext, IaC and provisioning, so it must precede the first migration.  
  **Done when:** docs/adr/0003-tenancy.md is merged and approved, and the data-model, IaC and provisioning tasks reference it.
- [ ] **P0-19** ⚑ Set the builder data-access rule: build sessions never read raw or masked client data  
  _Both · Legal & compliance · effort S · after P0-12, P0-16_  
  The builder (Claude via Claude Code and connectors) develops parsers, masker and matcher on synthetic fixtures; real data is processed only by Workers in the production account under the API DPA. Org staff do hand-labelling and spot checks in protected admin pages, the builder sees aggregate metrics only, and any production access is an org-approved, expiring, audited break-glass grant.  
  **Done when:** The privacy lead has approved the rule, it is in SECURITY.md, the builder's Cloudflare role cannot read production D1/R2 data without a grant, and one break-glass drill is recorded.
- [ ] **P0-20** ⚑ Complete the LIA and the DPIA history section for analysing historical DMs, including the masking spec  
  _Both · Legal & compliance · effort M · after P0-13, P0-06, P0-14 · needs Q1, Q2, Q3_  
  Document the purpose, why masked data suffices, the balancing test, the Art. 9 condition or the rule to exclude or mask health content, and whether past contacts must be told under Art. 14. Define what is masked before data reaches Claude (names, handles, phones, emails, addresses, dates of birth, card numbers, third parties, health details per the rule; images and voice notes excluded), retention for raw exports, masked data and the token key, and the processors.  
  **Done when:** A signed LIA and DPIA history section record the lawful basis, Art. 9 handling, masking spec, retention, transparency decision and a go/no-go for sending masked data to the Batch API.
- [ ] **P0-21** ⚑ Publish an interim privacy notice v0, terms and data-deletion instructions on the organisation's website  
  _Both · Legal & compliance · effort S · after P0-01, P0-06, P0-04 · needs Q1, Q2_  
  A short, accurate notice in the main DM language covering DM handling, AI drafting with human review, handoff calls, known sub-processors, rights and contacts, plus /terms and /data-deletion pages. It can sit on the existing website (no DNS move needed) and unblocks the Meta app, App Review and the TikTok application; v1 replaces it before shadow mode.  
  **Done when:** All three pages return 200 over HTTPS on the organisation's domain and the legal reviewer's approval is recorded.
- [ ] **P0-22** ⚑ Audit the Instagram account: professional type, people with access, 2FA and message settings  
  _Organisation · Accounts & approvals · effort S · after P0-09 · needs Q8_  
  Confirm it is a business (preferred) or creator account, record handle, ID and registration country, list everyone and every tool with access, and turn on authenticator 2FA. Remove scrapers and private-API tools now; official automations are switched off just before shadow (P3-01) so current lead handling is not disrupted.  
  **Done when:** The register row shows a professional account with 2FA, the access list, no unofficial tools, and screenshots of the message-access settings.
- [ ] **P0-23** ⚑ Confirm or create the Meta Business portfolio in the organisation's legal name  
  _Organisation · Accounts & approvals · effort S · after P0-09 · needs Q8_  
  Use the existing portfolio if there is one (check its admins), otherwise create it with legal name, address and website. Add two org admins, require 2FA, add the Instagram account (and a Facebook Page if the API route needs it) as assets, and give the builder partial access only.  
  **Done when:** The portfolio shows the legal name, 2 admins, 2FA required, the Instagram asset and the builder with partial access.
- [ ] **P0-24** ⚑ Submit Meta Business Verification in week 1  
  _Both · Accounts & approvals · effort M · after P0-23 · needs Q1, Q8_  
  Gather documents whose legal name and address match the portfolio exactly, make the website show the same details, and verify the domain with a TXT record, meta tag or HTML file at the current DNS host (no Cloudflare move needed). Meta often keeps 'Start verification' disabled until the portfolio owns an app or WhatsApp account, so if it is greyed out, create the bare Business-type app from P0-25 first (its URLs can be added later) and start from Security Center or the app dashboard. Log the submission date and answer follow-ups within a day; Meta sets the pace and P0-30 holds the fallback if it slips.  
  **Done when:** Security Center shows Business Verification 'Verified' and the domain 'Verified'.
- [ ] **P0-25** ⚑ Create the production Meta app and settle the login route and permissions to request  
  _Both · Accounts & approvals · effort S · after P0-23, P0-21 · needs Q8_  
  Create a Business-type app owned by the portfolio, add the Instagram product, give app roles to two org admins and the builder, and save the privacy, terms and deletion URLs. Confirm the route (Instagram Login or Facebook Login for Business) and permission names, and decide now whether instagram_business_manage_comments (comment-to-DM) and the HUMAN_AGENT feature go in the first review; the production callback will point only at production.  
  **Done when:** The dashboard shows the app owned by the portfolio with Instagram added, URLs saved without errors, App ID/secret in the vault and the permission list recorded.
- [ ] **P0-26** ⚑ Create a staging Meta app, a test professional Instagram account and tester accounts  
  _Both · Accounts & approvals · effort S · after P0-23 · needs Q8_  
  A Meta app has one callback per object, so create a separate staging app kept in Development mode and never reviewed, connected to a dedicated test professional Instagram account. Add 1-2 tester Instagram accounts with app roles and keep all logins in the vault.  
  **Done when:** The staging app exists with the test business account connected, tester invites accepted and logins in the vault.
- [ ] **P0-27** Check TikTok eligibility and set up TikTok Business Center  
  _Organisation · Accounts & approvals · effort S · after P0-09 · needs Q1, Q8_  
  Confirm the TikTok account is a Business Account and record its registration country; the Business Messaging API is not available to accounts registered in the EEA, UK or Switzerland. Create or confirm a Business Center in the legal name with two admins and 2FA, link the account and give the builder least privilege.  
  **Done when:** The register shows account type, registration country and an eligible or region-blocked verdict, and the Business Center has 2 admins with the account linked.
- [ ] **P0-28** Apply for the TikTok Business Messaging API in weeks 1-2, or record ineligibility  
  _Both · Accounts & approvals · effort S · after P0-27, P0-21 · needs Q1, Q8_  
  Check the current open-beta application route; the builder drafts the use case (lead DMs, AI-assisted replies with disclosure, human handoff, 48h window, at most 10 messages per user message) and the organisation submits it with the privacy URL. Skip if the account is region-blocked.  
  **Done when:** The application reference is in the register, or a 'not eligible' verdict is recorded.
- [ ] **P0-29** Decide the TikTok route and the trigger for the fallback  
  _Both · Accounts & approvals · effort S · after P0-27, P0-14 · needs Q1, Q4, Q8_  
  Region-blocked accounts get manual mode only (AI drafts in the app, a person sends in TikTok, leads invited to Instagram or WhatsApp), because partners run on the same API. Use respond.io or SleekFlow only if the account is eligible but refused or delayed, after the partner confirms in writing that TikTok DMs work for that country; compare bridge API/webhooks, seat price, DPA and data location, and set a trigger date.  
  **Done when:** An owner-approved note names the route (direct API, partner or manual), the trigger condition and date, and the cost.
- [ ] **P0-30** ⚑ Pre-agree the Instagram contingency if Business Verification or App Review slips  
  _Both · Accounts & approvals · effort S · after P0-01 · needs Q8, Q9_  
  Set a trigger date (e.g. no Advanced Access by week 7) and the fallback: manual-assist mode, where staff paste the inbound DM into the team app, the AI drafts and staff send from Instagram (built anyway in P2-50), or an official Meta partner inbox bridged to the gateway after checking its terms and DPA.  
  **Done when:** A signed note names the trigger date and the chosen fallback, with its cost and DPA status known.
- [ ] **P0-31** ⚑ Choose the coordinator calling setup and the organisation number the AI gives out  
  _Both · Accounts & approvals · effort S · after P0-01 · needs Q1, Q4, Q5_  
  Choose org-owned mobiles, a VoIP app with the org's caller ID, or the existing phone system so clients never see personal numbers and recognise the callback. Cover inbound calls from leads given the number (who answers, out-of-hours voicemail, matching caller ID to the lead) and check whether recording is possible (off by default).  
  **Done when:** The decision note is filed, a test call from each coordinator device shows the org caller ID, and the approved public number is stored in config.
- [ ] **P0-32** ⚑ Supply the approved procedure catalogue and price list  
  _Organisation · History & playbook · effort S · after P0-01, P0-06 · needs Q2, Q6_  
  List every procedure with category, typical session count, 'from' price or range, currency and validity date, owner-signed, with procedure descriptions signed by the clinician. This single source feeds the claims list, extraction categories, Playbook v0/v1, the get_price tool, the lint and clinic master data.  
  **Done when:** A versioned, owner-signed price list with no blank required fields is in the organisation's document store.
- [ ] **P0-33** ⚑ Supply the current FAQs, saved replies and call scripts  
  _Organisation · History & playbook · effort S_  
  Export what staff use today in every DM language: Instagram and TikTok saved and quick replies, instant-reply and away-message text, FAQ documents and the website FAQ, and current call scripts. Mark each item current or outdated. Playbook v0 (P1-34) and the normal scenarios in the eval set (P1-32) are built from these. Capture the instant-reply text before P3-01 switches those automations off.  
  **Done when:** The FAQ, saved-reply and call-script pack is in the organisation's document store, every item is marked current or outdated, and the owner has confirmed it is complete.
- [ ] **P0-34** Look up or request the organisation's D-U-N-S number  
  _Organisation · Accounts & approvals · effort S · after P0-01 · needs Q1_  
  Apple Developer (organisation) enrolment and Apple Business Manager need it, and new Google Play Console organisation accounts require it with a legal name and address matching the payments profile; issuing can take up to about 30 days (verify). Starting now keeps native-app enrolment off the critical path.  
  **Done when:** A D-U-N-S number matching the legal name is recorded in the register.
- [ ] **P0-35** ⚑ Confirm domain ownership and move DNS (or a delegated subdomain) to Cloudflare  
  _Both · Accounts & approvals · effort S · after P0-10_  
  Confirm the domain is registered to the legal entity with auto-renew and registrar 2FA. Export and recreate every record (especially MX/SPF) before switching, or delegate a subdomain, then create app., api., mcp. and staging. hostnames.  
  **Done when:** The zone or subdomain is Active in Cloudflare, the existing website and email still work, and the four hostnames resolve with valid TLS.
- [ ] **P0-36** ⚑ Scaffold the minimal TypeScript monorepo  
  _Builder · Core platform · effort S · after P0-02_  
  pnpm workspaces with workers/gateway, workers/history, packages/db and packages/shared; strict TypeScript, ESLint, Prettier and Vitest with the Workers pool. Record the framework choice in an ADR (proposal: React + Vite SPA on Workers static assets, Hono for APIs); apps/web, UI packages and Playwright arrive in P2.  
  **Done when:** On a fresh clone `pnpm install && pnpm lint && pnpm typecheck && pnpm test` passes and the README documents the commands.
- [ ] **P0-37** ⚑ Settle repository ownership, lock it down and set up minimal CI/CD  
  _Both · Core platform · effort S · after P0-36, P0-04, P0-10_  
  Move the repo to the owner chosen in P0-04 with two owners, required 2FA, protected main, secret-scanning push protection and Dependabot. Add a scoped, expiring Cloudflare API token and 'staging'/'production' GitHub environments; CI runs lint, typecheck and tests, deploys staging on merge, and production only after reviewer approval.  
  **Done when:** A merge deploys a hello-world Worker to staging, a production deploy waits for approval, and a direct push to main is rejected.
- [ ] **P0-38** ⚑ Define infrastructure as code for staging and production, starting with the history resources  
  _Builder · Core platform · effort M · after P0-36, P0-17, P0-18, P0-37 · needs Q1_  
  wrangler.jsonc per Worker with env.staging and env.production, each with its own D1, R2 buckets (raw exports, attachments, backups, restricted clinical), Queues with DLQs, Durable Object classes, crons, routes and a pinned compatibility_date, all in the location from P0-17. A check script fails a deploy when a secret listed in docs/secrets.md (P2-04) is missing.  
  **Done when:** `pnpm infra:check` confirms every resource exists in staging and production in the chosen jurisdiction, and both deploy purely from config.
- [ ] **P0-39** ⚑ Issue per-service Anthropic API keys, set spend limits and smoke-test the models  
  _Both · Accounts & approvals · effort S · after P0-11, P0-10, P0-07_  
  One key per service and environment (reply engine staging/production, history batch), stored only in the vault and as Workers secrets. Set per-workspace spend limits from the budget, then confirm claude-opus-5-5 and the Message Batches API work and record the rate-limit tier.  
  **Done when:** Each key returns a claude-opus-5-5 response, a test batch completes on the history key, spend limits are set and key names (not values) are in the register.
- [ ] **P0-40** ⚑ Inventory the accounts, staff names and non-lead handles the DM history covers  
  _Organisation · History & playbook · effort S · after P0-01 · needs Q8_  
  List every Instagram and TikTok account that received lead DMs (including old ones) with a named exporter and working 2FA, a roster of past and present staff names and nicknames who replied (for masking tokens and impersonation checks), and non-lead handles to exclude (suppliers, influencers, staff personal accounts).  
  **Done when:** The inventory, staff roster and exclusion list are in the organisation's document store with every account assigned an exporter.
- [ ] **P0-41** Provision the private R2 export bucket and a resumable upload path  
  _Builder · History & playbook · effort S · after P0-17, P0-18, P0-37_  
  Create the bucket via IaC in the P0-17 jurisdiction with public access and r2.dev disabled. Uploads use presigned multipart URLs from an admin-only endpoint (exports can be several GB); only the history pipeline can read, and each object's SHA-256 is stored.  
  **Done when:** A 5 GB test ZIP uploads with its checksum recorded, and unauthenticated GET and list attempts fail.
- [ ] **P0-42** Write and sign the export runbook and secure-handling protocol  
  _Both · History & playbook · effort S · after P0-41, P0-06_  
  Document the exact paths (Instagram: Accounts Center > Download your information > Messages, All time, JSON; TikTok: Download your data, JSON including Direct Messages) with verified screenshots. Name who downloads on which org-managed device, the 4-day download window, checksum and upload steps, deletion of local copies, the access list and log, and a destruction date for raw archives; never email, chat apps or personal drives.  
  **Done when:** The privacy lead has signed the runbook and the export owner confirms they can follow it unaided.
- [ ] **P0-43** Request the all-time Instagram DM export for each account  
  _Organisation · History & playbook · effort S · after P0-42, P0-40 · needs Q8_  
  Follow the runbook for each account and log the request date and the address the 'ready' notice goes to. Make sure every part of a split export is requested.  
  **Done when:** Every Instagram account in the inventory shows an export pending or ready, with dates in the custody log.
- [ ] **P0-44** Request the TikTok data export (JSON, including Direct Messages) for each account  
  _Organisation · History & playbook · effort S · after P0-42, P0-40 · needs Q8_  
  Follow the runbook and log the request date, then record which DM date range the export actually covers and whether media is included.  
  **Done when:** Each TikTok account shows an export pending or ready, with request date and verified DM coverage in the custody log.
- [ ] **P0-45** Download each export within the 4-day window, checksum it and upload to R2  
  _Organisation · History & playbook · effort S · after P0-43, P0-44, P0-41, P0-05_  
  A named primary and backup check daily for 'ready' emails, download on an org-managed device, compute SHA-256, upload by the runbook path and delete local and trash copies, logging each step. If a link expires, re-request at once.  
  **Done when:** Every export part is in R2 with a SHA-256 matching the custody log and the uploader confirms local copies are deleted.
- [ ] **P0-46** Collect outcome records and current-tool exports in one request  
  _Organisation · History & playbook · effort M · after P0-41, P0-42 · needs Q3, Q5, Q6_  
  List every tool in use (calendar, clinic software, payments, WhatsApp Business, spreadsheets) with admin owner, API/CSV availability and an integrate-or-replace decision. Export booking diaries, client list with first-visit dates, payment records (no card data), call logs, open leads, future appointments and active courses as CSV/XLSX with a data dictionary each, through the same private intake path, serving both history matching and later migration.  
  **Done when:** The owner signs the tool inventory, every available file is uploaded with its dictionary, and periods with no records are noted.

## P1 · History analysis and playbook (2-5 for Playbook v0 and the legal base; history-based Playbook v1 realistically weeks 7-9)

Exit criteria:

- Playbook v0 approved, lint-clean and clinician-signed on its version hash
- Claims, banned-phrase/medicine, minors, AI-disclosure and escalation wording approved in every DM language
- Adversarial eval set built and rubric calibrated (kappa >= 0.6)
- DPIA signed with a dated prior-consultation decision; ROPA, retention schedule and privacy notice v1 live
- History parsed, masked (audit passed), extracted and labelled; findings report walked through; Playbook v1 drafted and compliance-reviewed
- SMS sender registration submitted and WhatsApp number connected

- [ ] **P1-01** ⚑ Design the core conversation data-model slice as a shared package  
  _Builder · Core platform · effort S · after P0-36, P0-18_  
  Define clients, identities (Instagram, TikTok, E.164 phone, email, WhatsApp; unique per org), episodes, conversations and messages with ULIDs, UTC timestamps and org_id per the tenancy ADR. History and live systems share these field names so extraction and eval code work on both; P2-02 extends it.  
  **Done when:** packages/shared contains the schema and docs, and a unit test round-trips a sample conversation from each platform.
- [ ] **P1-02** Choose and set up the processing environment for multi-GB exports  
  _Builder · History & playbook · effort S · after P0-38, P0-19_  
  A Worker cannot unzip a multi-GB archive in roughly 128 MB of memory, so stream per file from R2 using Workflows or Containers in the organisation's account (verify limits). Per P0-19, real data is never processed on the builder's machine.  
  **Done when:** An ADR records the choice and a synthetic 5 GB archive is streamed and listed file by file in staging.
- [ ] **P1-03** Define the history storage schema  
  _Builder · History & playbook · effort S · after P1-01_  
  D1 tables keyed by workspace for history conversations, messages, attachments, lead episodes, outcome records, matches, labels and extractions, with large bodies in R2 JSONL. Message fields include channel, direction, ts_utc, text, type (text, image, video, audio, story reply/mention, share, reaction, call, unsent), reply_to, source_file and parser_version.  
  **Done when:** The migration and schema doc are merged and apply cleanly on staging.
- [ ] **P1-04** Build the protected history review and labelling pages for org staff  
  _Builder · History & playbook · effort M · after P1-03, P0-19, P0-38_  
  P0-19 says org staff do spot checks and hand-labelling in protected admin pages while the builder sees only aggregates, but no task builds those pages before P1-14. Build one admin area behind Cloudflare Access, open only to named org staff, with: a parsed-conversation viewer for the coverage check (P1-07) and the episode-split review (P1-08); a PII labelling screen for the masking audit (P1-10) that reports only recall to the builder; and an episode annotation form for the extraction ground truth (P1-16). Every view and label is audited. P1-14 and P1-15 extend it.  
  **Done when:** On production, a named org reviewer can open each screen behind Cloudflare Access, the builder's identity is refused, every view and label writes an audit row, and the builder's view shows only aggregate counts and recall metrics.
- [ ] **P1-05** Build the Instagram export parser  
  _Builder · History & playbook · effort M · after P1-02, P1-03, P0-45_  
  Walk every messages folder (inbox, message_requests and others), merge message_N.json parts, fix Meta's mis-encoded non-ASCII text, and map participants, timestamps, content, media, shares, reactions, story replies, unsent messages and calls. Develop on synthetic fixtures mirroring the real structure, then run in the organisation's account, copying referenced media into R2 and logging missing files.  
  **Done when:** The parser runs on the full export without crashes, per-file message counts match the raw JSON, and CI fixture tests cover every message type found.
- [ ] **P1-06** Build the TikTok export parser  
  _Builder · History & playbook · effort M · after P1-02, P1-03, P0-45_  
  Parse the Direct Messages section (confirm key paths on the real export), work out the timezone of the date strings, map sender to org or lead, and handle shared videos, stickers and media placeholders. Record what the export leaves out for the coverage report.  
  **Done when:** The parser runs on the full TikTok export, per-chat counts match the raw JSON, and fixture tests cover every entry type.
- [ ] **P1-07** Produce the export coverage report and have the organisation accept or fix gaps  
  _Both · History & playbook · effort S · after P1-05, P1-06, P1-04_  
  Per account: conversations, messages, first and last dates, messages per month (zero months flagged), request-folder chats and missing media. Org staff confirm 10 remembered converted clients are present and compare 5 chats with the live app; export gaps are re-exported, the rest recorded as known limits.  
  **Done when:** The organisation signs the report with every gap marked re-exported or accepted.
- [ ] **P1-08** Normalise, de-duplicate and split history into lead episodes  
  _Builder · History & playbook · effort M · after P1-05, P1-06, P0-40, P1-04_  
  Convert to UTC plus local time, tag org vs lead side from the inventory, remove duplicates across parts and re-exports, exclude listed non-lead handles, and split threads into episodes after a tunable inactivity gap (start at 90 days) so returning clients count as new enquiries.  
  **Done when:** Normalised counts equal raw counts minus logged exclusions and duplicates, and an org reviewer confirms the split on 20 random episodes.
- [ ] **P1-09** Build PII masking, the health-content rule and an encrypted token key table  
  _Builder · History & playbook · effort M · after P1-08, P0-20, P0-40 · needs Q1, Q7_  
  Implement the P0-20 spec: stable per-person tokens for names, staff names, phones (libphonenumber), emails, handles, URLs, addresses, dates of birth, card-like numbers and IDs, plus the agreed health-content exclude/mask rule, keeping flags such as phone_shared. Token-to-value pairs live in a separate D1 table encrypted with a Worker-secret key, readable only by the matcher and named admins, with every read audited.  
  **Done when:** The masked dataset exists, an automated scanner finds no phone, email or handle patterns in anything bound for Claude, and key-table access is restricted and audited.
- [ ] **P1-10** Audit masking quality on a staff-labelled sample before any data reaches Claude  
  _Organisation · History & playbook · effort S · after P1-09 · needs Q7_  
  Org staff (not the builder) hand-label PII in 300 random messages across languages and platforms in a protected admin page, and a reviewer reads 50 masked conversations for residual identifiers (nicknames, rare names, locations). The builder sees only recall metrics and fixes the masker until targets are met.  
  **Done when:** Recall is at least 99% for phones, emails and handles and 95% for names, the reviewer signs off, and the privacy lead releases masked data for the Batch API.
- [ ] **P1-11** Configure retention and erasure for raw exports, masked data and the key table  
  _Both · History & playbook · effort S · after P0-20, P1-09 · needs Q1_  
  Set an R2 lifecycle rule deleting raw ZIPs after the agreed period once QA is done, retention timers for the key table and masked dataset, and an erase-person function removing a person's tokens, episodes, extractions and eval items.  
  **Done when:** The lifecycle rule is visible in R2 config and an erasure test on a seeded person leaves no rows or objects referencing them.
- [ ] **P1-12** Import outcome records into a common outcome schema  
  _Builder · History & playbook · effort M · after P0-46, P1-03, P1-09 · needs Q3, Q5_  
  Write a mapper per source into outcome_record with identifiers (E.164 phone, email, handle, normalised name) and events (enquiry, number shared, called, booked, attended, paid, cancelled) plus date, procedure category and amount band. Unparseable rows go to a reject log, and identifiers live only in the key table.  
  **Done when:** For every file, loaded plus rejected rows equal the source count and rejects have been reviewed with the organisation.
- [ ] **P1-13** Match conversations to outcomes with confidence scores  
  _Builder · History & playbook · effort M · after P1-12 · needs Q3_  
  Deterministic matches first (shared phone or email, same handle), then fuzzy ones (name similarity plus a booking within N days of the last DM with the same procedure). Auto-accept high scores, send the middle band to review and reject the rest, tuning thresholds on org-verified pairs.  
  **Done when:** On 100 verified pairs and 100 non-pairs, auto-accepted matches reach at least 95% precision and the review band size is reported.
- [ ] **P1-14** Run a protected review queue for uncertain matches  
  _Both · History & playbook · effort M · after P1-13 · needs Q3_  
  The builder provides an admin page behind Cloudflare Access (free up to 50 users) showing each candidate record beside the masked DM snippet. Permitted org staff confirm, reject or mark unsure with a reason, and every decision is logged.  
  **Done when:** Every medium-confidence candidate has a logged decision or is marked unresolved, and decisions are applied to labels.
- [ ] **P1-15** If outcome records are thin, have staff label a stratified sample of episodes  
  _Both · History & playbook · effort M · after P1-08, P1-14 · needs Q3_  
  Contingency for weak Q3 records: two staff label 300-500 masked episodes as converted, number shared or cold in the protected page, using diaries and memory, recording the label source. Where nothing else exists, 'number shared' is used as a proxy outcome.  
  **Done when:** Either a written decision says the records suffice, or at least 300 staff labels with sources exist.
- [ ] **P1-16** Design the per-episode extraction schema and prompt  
  _Both · History & playbook · effort M · after P1-10, P0-32 · needs Q2, Q7_  
  Structured-output JSON: lead flag, languages, procedure categories, opener, qualifying questions, objections and answers, price handling, number requested/shared (by whom, when), drop-off point, tone, and compliance flags (medical advice, promised results, prescription-only medicine named, possible minor, card details) with masked quotes. Response times are computed in code, Claude never sees the outcome label, and org staff annotate 30 episodes as ground truth.  
  **Done when:** Schema and prompt are versioned with at least 85% field agreement on the 30 annotated episodes (95% on number requested/shared).
- [ ] **P1-17** Estimate the Batch API cost and get the budget approved  
  _Both · History & playbook · effort S · after P1-16, P0-39_  
  Count tokens on the masked episodes with the token-counting endpoint, add expected output, and price claude-opus-5-5 ($4/$20 per MTok) against claude-sonnet-5-5 at the 50% Batch discount with the shared system prompt cached (verify current prices). Compare with the blueprint's ~$150-400 estimate.  
  **Done when:** A written estimate with token counts, chosen model and a hard cap is approved by the owner and the matching spend limit is set on the history workspace.
- [ ] **P1-18** Run a pilot batch on 200 stratified episodes  
  _Builder · History & playbook · effort S · after P1-17, P1-10, P0-12_  
  Sample across platform, year, language, procedure and provisional label, submit one batch keyed by episode id, validate against the schema and compare with the 30 annotations. Org staff inspect failing examples and the prompt is improved.  
  **Done when:** At least 98% of results are schema-valid, the accuracy targets are met, and cost per episode is within 20% of the estimate.
- [ ] **P1-19** Run the full extraction batch and store versioned results  
  _Builder · History & playbook · effort M · after P1-18_  
  Split episodes within current batch limits, poll to completion, retry errored or expired requests once, and download results before Anthropic's result-retention window closes (verify). Store results with prompt, schema and model versions.  
  **Done when:** Every eligible episode has a valid extraction or a logged failure (under 1%) and spend is under the approved cap.
- [ ] **P1-20** Agree outcome label definitions and label every episode  
  _Both · History & playbook · effort S · after P1-14, P1-15, P1-19 · needs Q3_  
  The organisation confirms the labels: converted (attended or paid within N days), number shared but not booked, cold, and excluded (spam, non-lead, existing-client admin, under 18). Labels come from matches, staff labels, phone_shared flags and the extraction's lead flag, each with source and version.  
  **Done when:** Every episode has one label with its source and the organisation agrees the distribution by platform, year and language is plausible.
- [ ] **P1-21** Compare converted, number-shared and cold episodes statistically  
  _Builder · History & playbook · effort M · after P1-20, P1-19, P1-07_  
  First set aside the most recent ~20% of episodes as the eval holdout. Answer what gets the number shared and what turns shared into booked, reporting n, rates, 95% CIs and logistic-regression effects controlling for year, platform, procedure and staff, with Benjamini-Hochberg correction and cells under 30 marked insufficient.  
  **Done when:** A masked findings report gives every finding an ID, n, effect, CI and adjusted p-value (or 'insufficient data') and has been walked through with the organisation.
- [ ] **P1-22** Build a masked exemplar library of winning and losing replies per language  
  _Builder · History & playbook · effort M · after P1-21 · needs Q7_  
  For each top finding and objection type, a Batch API run in the organisation's account picks 3-5 winning and 3-5 losing masked org replies with episode IDs and drafts candidate wordings per language. Exemplars with a compliance flag are dropped, and org reviewers read the library.  
  **Done when:** The library covers every top-10 finding and objection type in each language with at least 20 episodes, every exemplar traces to an episode ID, and none carries a compliance flag.
- [ ] **P1-23** ⚑ Define the versioned playbook format the reply engine loads  
  _Builder · History & playbook · effort S · after P0-36_  
  YAML/JSON plus markdown sections: openers, qualifying questions per procedure, objection handling, price handling (price-list IDs only), when to ask for the number, tone per language, do and don't, disclosure, path to a human and escalation triggers. Each rule carries id, evidence references, clinical flag, status, approver and version hash.  
  **Done when:** The playbook JSON Schema is merged and a sample playbook validates in tests.
- [ ] **P1-24** ⚑ Supply the staff roster, branches, roles, hours, SLA ladder and escalation contacts as data  
  _Organisation · Core platform · effort S · after P0-01 · needs Q4_  
  For each staff member: name, work email, mobile, branch, role template and permission tweaks; name the coordinators, manager, owner and on-duty clinicians for the ladders; confirm opening hours, quiet hours and on-call cover; accept or change the default ladder (call within 15 min, manager at 15, owner at 60) and say which roles may see phone numbers.  
  **Done when:** The owner signs the roster, permission matrix and SLA ladder in the organisation's document store.
- [ ] **P1-25** ⚑ Compile the approved claims list with substantiation  
  _Organisation · Legal & compliance · effort M · after P0-06, P0-32 · needs Q2_  
  For each procedure, set what the AI and staff may say (what it is, typical sessions, downtime, 'from' prices, how results are described), each line with its evidence source and approving clinician. Anything not on the list is off-limits to the AI.  
  **Done when:** A versioned claims list with an evidence column and clinician approval on every line is in the organisation's document store.
- [ ] **P1-26** ⚑ Build the banned-phrase and prescription-only medicine naming rules per jurisdiction and language  
  _Both · Legal & compliance · effort S · after P0-13, P1-25 · needs Q1, Q2, Q7_  
  List banned phrases (guarantees, 'risk-free', 'painless', 'permanent', unsubstantiated superlatives, pressure to act now) and prescription-only medicine names that must not be promoted where banned (e.g. Botox under UK rules; verify per country), with neutral alternatives in every DM language. Deliver it as data with a test set.  
  **Done when:** The versioned list is approved by the legal reviewer and clinician, with a test set of at least 50 violating and 50 compliant messages.
- [ ] **P1-27** ⚑ Set the minors policy and age-check wording  
  _Both · Legal & compliance · effort S · after P0-13 · needs Q1, Q2, Q7_  
  Fix the minimum age per procedure and country (e.g. England bans botulinum toxin and fillers for under-18s; verify others) and when the AI asks for age. On a stated age under 18 the AI stops, a human is alerted, the 'under 18' exit is set, marketing stops and data is minimised; the flag can be cleared only by correcting the age after an ID check, never by override.  
  **Done when:** The policy and refusal wording are approved in every DM language and the cases are in the adversarial test set.
- [ ] **P1-28** ⚑ Complete the EU AI Act Art. 50 and bot-law assessment and approve disclosure strings  
  _Both · Legal & compliance · effort M · after P0-13 · needs Q1, Q7_  
  Art. 50 has applied since 2 Aug 2026, including for EU users of non-EU organisations; record deployer and provider roles and check US state bot laws for client locations (verify). Write a first-message disclosure and a short reminder for Instagram, TikTok, WhatsApp, SMS and email in each language within length limits, naming how to reach a person; disclose in co-pilot too, and the AI never signs as a named staff member.  
  **Done when:** The assessment is signed by the privacy lead and disclosure strings per channel and language are approved, checked by a native speaker and versioned as config.
- [ ] **P1-29** ⚑ Approve the human-escalation wording and the 'talk to a person' path  
  _Both · Legal & compliance · effort S · after P0-13, P1-24 · needs Q4, Q7_  
  Write wording for: asks for a human, clinical or suitability question, complaint, possible minor, out-of-hours, and number shared, with trigger keywords per language. The call-back promise is a variable filled from the SLA ladder.  
  **Done when:** Approved wording per case and language and the keyword list are delivered as playbook entries and test cases.
- [ ] **P1-30** ⚑ Define the clinician sign-off process for playbook and knowledge-base changes  
  _Both · Legal & compliance · effort S · after P0-06 · needs Q2_  
  Name approvers with registration numbers, list what needs clinical sign-off (clinical statements, aftercare, contraindications, qualifying questions, consent forms, escalation triggers), set turnaround, and require re-approval on every change with approver, version hash and timestamp recorded.  
  **Done when:** The process is approved and its record fields are in the playbook format.
- [ ] **P1-31** ⚑ Build the guardrail lint run on every playbook version  
  _Builder · History & playbook · effort S · after P1-23, P0-40, P0-32 · needs Q1, Q2_  
  Fail on banned phrases and prescription-only medicine names per jurisdiction, outcome promises, medical or suitability wording, real staff names, requests for card details, prices not referenced from the price list, openers without disclosure, and missing under-18 handling. It runs in CI and before any publish.  
  **Done when:** The lint runs in CI and fails a seeded bad playbook once for each rule.
- [ ] **P1-32** ⚑ Build the synthetic adversarial and scenario eval set  
  _Both · History & playbook · effort M · after P1-25, P1-26, P1-27, P1-28, P1-29, P0-32, P0-33 · needs Q2, Q7_  
  No history needed: at least 150 adversarial cases (clinical and suitability questions, stated age under 18, card details offered, requests for a named staff member, 'are you a bot', injection attempts, price traps, angry users, closed windows) plus normal scenarios from the organisation's FAQs, reusing the compliance test sets. Org staff label the expected behaviour (reply, handoff, no reply); stored in private R2, never in the repo.  
  **Done when:** A versioned set with a coverage table (at least 5 cases per guardrail and intent) is in R2 and every case has a signed expected-behaviour label.
- [ ] **P1-33** ⚑ Define the reply rubric and calibrate it with two staff graders  
  _Both · History & playbook · effort M · after P1-32 · needs Q7_  
  Any guardrail violation is an automatic fail; otherwise score price correctness, playbook adherence, the right next question, asking for the number at the right moment, language and tone, disclosure, and correct handoff. Two staff grade the same 50 items independently and disagreements become rubric clarifications.  
  **Done when:** The organisation approves the rubric and Cohen's kappa is at least 0.6 on the 50 items.
- [ ] **P1-34** ⚑ Write and approve a minimal safe Playbook v0 for shadow mode  
  _Both · History & playbook · effort M · after P0-32, P1-23, P1-25, P1-26, P1-27, P1-28, P1-29, P1-30, P1-31, P1-32, P0-33 · needs Q2, Q7_  
  This decouples go-live from the history analysis, which realistically finishes in weeks 7-9. v0 uses the organisation's current FAQs and call scripts, the price list, claims, disclosure, escalation and minors wording, and covers only logistics, listed prices, qualifying questions and steering to a call; v1 replaces it when approved.  
  **Done when:** v0 validates against the schema, passes the lint, and carries owner and clinician sign-off on its version hash.
- [ ] **P1-35** Draft Playbook v1 from the findings and exemplars  
  _Builder · History & playbook · effort M · after P1-21, P1-22, P1-23, P1-31, P0-32 · needs Q1, Q2, Q7_  
  Claude (claude-opus-5-5) drafts v1 from the findings, exemplar library, price list and AI scope rules, citing finding, exemplar or policy IDs for every rule. Content stays non-clinical and includes the disclosure and path to a human.  
  **Done when:** Draft v1 validates against the schema, every rule has a citation, and the lint passes.
- [ ] **P1-36** Review and edit Playbook v1 section by section  
  _Organisation · History & playbook · effort M · after P1-35 · needs Q7_  
  The playbook owner, manager and lead coordinators accept, edit or reject each rule with a comment in an interim shared document (the in-app editor arrives in P4), and a native speaker checks tone per language. Every edit is re-linted.  
  **Done when:** Every rule is approved or rejected with reviewer and reason, and the final text passes the lint.
- [ ] **P1-37** Run the compliance review and clinician sign-off of Playbook v1  
  _Both · Legal & compliance · effort M · after P1-36, P1-25, P1-26, P1-30 · needs Q2_  
  Check every answer, price, question and template against the claims list, banned-phrase list, minors policy and disclosure rules, fixing or removing failures. The clinician signs clinical rules (name, registration number, version hash) and the legal reviewer signs marketing lines.  
  **Done when:** The review sheet marks every line pass, fixed or removed with reviewer names, and no clinical rule is unsigned.
- [ ] **P1-38** Build the history-derived golden set from the holdout  
  _Both · History & playbook · effort M · after P1-21, P1-32 · needs Q3, Q7_  
  From the holdout, pick ~300 masked decision points (context, actual human reply, outcome) stratified by stage, language, procedure, platform and outcome, including price pushback, story replies, voice notes, shared numbers and after-hours. Staff label the expected behaviour.  
  **Done when:** A versioned set with a coverage table (at least 5 cases per stratum) is in R2 next to the adversarial set.
- [ ] **P1-39** ⚑ Create the records of processing activities (ROPA)  
  _Both · Legal & compliance · effort S · after P0-14, P0-20 · needs Q1, Q5_  
  One entry each for DM lead handling, AI replies, history analysis, coordinator calls, appointments and treatment plans, payments, marketing and retention messages, and staff accounts and audit logs, with purpose, lawful basis, data categories, recipients, transfers, retention and security.  
  **Done when:** The privacy lead has adopted a ROPA covering every listed activity.
- [ ] **P1-40** ⚑ Approve the retention schedule and the deletion-job requirements  
  _Both · Legal & compliance · effort M · after P0-13, P1-39 · needs Q1, Q2_  
  Set period, trigger and delete-or-anonymise for unconverted leads and spam, DM transcripts, the raw webhook archive (e.g. 14-30 days), AI drafts and audit logs, consent records, recordings, exports and masked data, clinical records, consent forms and photos (verify statutory minimums), payment records, backups, under-18 records and alumni. Name the stores for each (D1, R2, Queues, Durable Objects, logs, backups, Batch API files) and a legal-hold override needing a logged reason.  
  **Done when:** The privacy lead and clinician approve the schedule and a deletion-job spec with one acceptance test per category is merged.
- [ ] **P1-41** ⚑ Publish privacy notice v1, full and translated, before shadow mode  
  _Both · Legal & compliance · effort M · after P0-21, P0-14, P0-20, P1-40 · needs Q1, Q2, Q7_  
  Cover DM, call and form data, purposes and lawful bases, health data, AI drafting and replying with escalation, history analysis, sub-processors and transfers, retention, rights, the under-18 policy and contacts, in every DM language. Payment and clinic-software sections follow in v2 (P4-20).  
  **Done when:** v1 is live at the same URL in every DM language, approved by the legal reviewer with version and date recorded.
- [ ] **P1-42** ⚑ Sign the full DPIA for live processing with a dated prior-consultation decision  
  _Both · Legal & compliance · effort M · after P0-13, P0-14, P0-20, P1-39 · needs Q1, Q2, Q4_  
  Cover the data flows (DM, gateway, D1/R2, Claude, reply), special-category data, minors, AI disclosure and errors, automated side exits needing human review (Art. 22), calls, staff monitoring, MCP access, transfers and retention, with a risk register mapping each mitigation to a feature. If high residual risk needs prior consultation (up to 8+6 weeks under Art. 36), re-plan the live dates at once.  
  **Done when:** A signed DPIA with risk register, mitigation-to-feature map, residual-risk statement and dated prior-consultation decision is on file.
- [ ] **P1-43** Write the testimonials and before/after photo policy  
  _Both · Legal & compliance · effort S · after P0-13 · needs Q1, Q2_  
  Only genuine testimonials with documented source and permission; written client consent per photo use (scope, channels, withdrawal); no misleading edits; typical-results caveats where codes require (verify); restricted storage. Until approved, the AI shares no testimonials or photos.  
  **Done when:** The policy and a photo/testimonial consent template are approved and the playbook flag 'no testimonials' is set.
- [ ] **P1-44** Confirm insurance covers AI-assisted messaging, data breaches and new payment flows  
  _Organisation · Legal & compliance · effort S · after P0-13 · needs Q2_  
  Ask the broker whether professional indemnity and cyber policies cover AI-drafted or AI-sent messages, health-data breaches and processor incidents. Insurer conditions (e.g. human review, MFA) become go-live gate items.  
  **Done when:** The broker's written confirmation or exclusions are filed and any conditions appear in the shadow, co-pilot and autopilot gates.
- [ ] **P1-45** ⚑ Open the SMS provider account and start sender registration now  
  _Both · Accounts & approvals · effort M · after P0-09, P0-14, P0-15 · needs Q1, Q5_  
  Pick a provider covering the organisation's country, open it in the owner's name, upgrade from trial and start each country's sender rules (e.g. US A2P 10DLC or toll-free verification, or an alphanumeric sender ID where allowed; verify), which take weeks. Alphanumeric IDs are one-way and cannot receive STOP replies, so client reminders and campaigns need a two-way number or another working opt-out route. Restrict geo-permissions, set a spend cap and create per-environment API keys instead of using the master token.  
  **Done when:** Sender registration is submitted (or approved) and per-environment keys are stored as Workers secrets.
- [ ] **P1-46** ⚑ Register one WhatsApp Business number with an approved display name  
  _Both · Accounts & approvals · effort S · after P0-23 · needs Q5_  
  Choose a new dedicated number or migrate the existing WhatsApp Business app number (check current coexistence rules first); one number serves staff alerts now and client reminders in P4. Create the WhatsApp Business Account in the portfolio, verify the number, store the PIN in the vault, get the display name approved and add a payment method.  
  **Done when:** WhatsApp Manager shows the number Connected, the display name Approved and a payment method added.

## P2 · Core platform, reply engine and App Review (3-9 (demo slice and App Review submission by week 5))

Exit criteria:

- App Review demo slice live on production with a green uptime check by week 5, and Advanced Access granted (target week 6-7)
- Auth with 2FA, RBAC, audit log, tenant isolation, inbox, composer and PWA push working on staging
- Send gate, reply engine, output guardrails and risk detectors pass the eval gate with a zero-violation v0 scorecard
- Handoff flow, SLA ladder and clinician route drilled on real phones
- Export/erase jobs pass the synthetic-person test; backup restored; monitoring alerts fire
- Numeric shadow/co-pilot/autopilot criteria signed
- Manual-assist capture (P2-51) working on staging by week 7, so the Instagram contingency can be triggered on time

- [ ] **P2-01** ⚑ Freeze the co-pilot MVP scope and re-phase non-essential work  
  _Both · Launch & operations · effort S · after P0-01, P0-08 · needs Q4, Q9_  
  Freeze what co-pilot needs: gateway, send gate, reply engine with guardrails, inbox and composer with manual-assist capture, handoff, phone detection, push/email plus SMS or WhatsApp alerts, SLA ladder, auth with 2FA, core RBAC, audit log, backups, monitoring and DSAR jobs. Confirm the items placed in P4/P5 (MCP, search, pipeline editor, merge wizard, call brief, previews) stay there.  
  **Done when:** An owner-signed scope list exists, the tracker reflects it, and the remaining critical P2 estimate fits weeks 3-8.
- [ ] **P2-02** ⚑ Extend the data model: full ERD, sensitivity classes and event contracts  
  _Builder · Core platform · effort M · after P1-01, P0-17_  
  Extend the P1 slice with branches, users, memberships, roles and overrides, leads, stage history, tasks, calls, notes, consents, do-not-contact, audit log and playbook versions, tagging every column public, contact PII, clinical, financial or internal. Define zod contracts for message.received, contact.captured, draft.created, lead.assigned, stage.changed and sla.breached.  
  **Done when:** docs/data-model.md (ERD, sensitivity table, erasure strategy) and the event schemas in packages/shared are merged.
- [ ] **P2-03** ⚑ Write the core D1 migrations and seed data  
  _Builder · Core platform · effort M · after P2-02_  
  Tables from organisations through playbook versions, notifications and SLA timers, with messages unique on org + channel + platform message id for dedupe and composite indexes starting with org_id. Check D1 size and statement limits, design pagination to fit, and seed fake multi-org data.  
  **Done when:** Migrations apply on local and staging, a test checks every tenant table has org_id and indexes, and the seed loads 2 orgs x 500 clients.
- [ ] **P2-04** ⚑ Write the secrets inventory and rotation runbook and rehearse a rotation  
  _Builder · Accounts & approvals · effort S · after P0-38, P0-39_  
  docs/secrets.md is the single owner of the secret list (names only): Meta app secret and verify token, Instagram tokens, TikTok/partner keys, WhatsApp system-user token, Anthropic keys, Cloudflare token, SMS, email, payment and push keys, VAPID and session signing keys. Each entry has vault item, Worker binding, environment, owner, rotation interval and steps.  
  **Done when:** docs/secrets.md covers every secret and one staging key has been rotated with no downtime.
- [ ] **P2-05** ⚑ Set up transactional email with domain authentication, templates and a DPA  
  _Both · Core platform · effort S · after P0-35, P0-14_  
  Compare Cloudflare's own email sending with Postmark, Resend and SES for the region, verify a sending subdomain with SPF, DKIM and DMARC (p=none, then quarantine after 2-4 clean weeks), and sign the provider's DPA. Templates: invitation, magic link, password reset, 2FA reset, alert fallback and daily brief; bounces are suppressed.  
  **Done when:** Test mails to Gmail and Outlook pass SPF/DKIM/DMARC and land in the inbox, a bounce suppresses the address, and the DPA is filed.
- [ ] **P2-06** ⚑ Build invitation-only login with password, magic link, sessions and device logout  
  _Builder · Core platform · effort M · after P2-03, P2-05_  
  Benchmark password hashing against Workers CPU limits (Argon2id via WASM if it fits, else documented PBKDF2), single-use 15-minute magic links, HttpOnly rotating session cookies with idle and absolute timeouts, a session list with 'log out other devices', admin 'revoke all sessions' and rate-limited auth endpoints.  
  **Done when:** Playwright covers invite, login, magic link and revoke, a revoked session gets 401 on its next request, and brute force returns 429.
- [ ] **P2-07** ⚑ Add passkeys and TOTP 2FA, recovery codes, step-up auth and Cloudflare Access  
  _Builder · Core platform · effort M · after P2-06_  
  WebAuthn passkeys with TOTP fallback, 10 one-time recovery codes and an org policy making 2FA mandatory. Step-up within 5 minutes for exports, erasure, permission changes, the kill switch and MCP authorisation; Cloudflare Access fronts /admin and staging; reviewer accounts can be issued with pre-enrolled TOTP.  
  **Done when:** On staging no user reaches the app without a passkey or TOTP, an export triggers step-up, recovery codes work once, and staging shows an Access login to strangers.
- [ ] **P2-08** ⚑ Implement core RBAC: permission catalogue, role templates and a single can()  
  _Builder · Core platform · effort M · after P2-03, P2-06_  
  Permissions per blueprint §06 (see chats, reply, see phone numbers, book, clinical notes and photos, payments, edit/approve playbook, analytics, manage users, export, AI controls, MCP) with templates for Owner, Manager, Lead coordinator, Front desk, Clinician, Finance, Marketing and Auditor. One can() serves API, UI, MCP and jobs; per-branch scopes and per-person overrides follow in P3-02.  
  **Done when:** A table-driven role x permission test passes, the UI hides and the API returns 403 for the same actions, and a change applies on the next request.
- [ ] **P2-09** ⚑ Specify the compliance audit-log and override-reason requirements  
  _Builder · Legal & compliance · effort S · after P0-13_  
  Log every AI message (prompt, playbook and model versions, confidence, guardrail results), human sends and edits, clinical-data views, overrides with required reasons, consent changes, DSAR actions and kill-switch use. Define immutability, who can read (auditors see masked data) and retention.  
  **Done when:** The spec is accepted for the audit-log build and maps each event to a test.
- [ ] **P2-10** ⚑ Build the append-only audit log with required override reasons  
  _Builder · Core platform · effort M · after P2-03, P2-08, P2-09_  
  Every write, clinical view, login, permission change, export, AI pause and MCP action writes one row (org, actor, entity, masked diff, reason, IP, user agent, request id). Overrides (off-path stage moves, reopening lost leads, SLA changes, reassignment, pausing AI) need a reason from a pick-list plus free text; hash chain and viewer follow in P3-03.  
  **Done when:** A test confirms every mutating route writes exactly one row and an override without a reason returns 422.
- [ ] **P2-11** ⚑ Enforce multi-tenant isolation and one-command workspace provisioning  
  _Builder · Core platform · effort M · after P2-03, P2-06, P0-18_  
  A TenantContext comes only from the authenticated session, an ESLint rule bans raw D1 access outside packages/db, R2 keys use org/{id}/ prefixes, Durable Object names include the org id and queue messages carry a validated org id. A script provisions a workspace with default roles, pipeline, SLA ladders, timezone, hours, locale and branding.  
  **Done when:** A router-generated cross-tenant suite (org A requesting org B ids gets 404) passes in CI and organisation 1 is provisioned on staging with one command.
- [ ] **P2-12** ⚑ Apply field-level masking, restricted clinical fields and view auditing in every output  
  _Builder · Core platform · effort M · after P2-08, P2-02, P2-10_  
  A serializer driven by sensitivity classes masks phones, handles and emails for masked roles, shows clinical fields only to permitted roles and financial fields only to Finance/Owner, and audits reveal-on-tap. The same rules apply to search, exports, push payloads, MCP and AI inputs; clinical free text is AES-GCM encrypted with key ids.  
  **Done when:** Per-role snapshot tests pass on client, conversation, search and export endpoints, clinical reads write audit rows, and push payloads contain no full numbers or clinical text.
- [ ] **P2-13** ⚑ Build the versioned REST API with OpenAPI, idempotency and personal API tokens  
  _Builder · Core platform · effort M · after P2-11, P2-08, P2-10_  
  A Hono router under /v1 for clients, identities, episodes, conversations, messages, leads, stages, tasks, calls, notes, users, roles, settings, notifications and audit, with zod validation, cursor pagination, Idempotency-Key and ETag/If-Match. The OpenAPI spec is generated at /v1/openapi.json, and hashed, expiring, revocable per-user tokens serve integrations.  
  **Done when:** The spec validates, generated contract tests pass in CI, every route has RBAC and tenant tests, and a revoked token gets 401.
- [ ] **P2-14** ⚑ Build the versioned price-list and location-facts store with a read API  
  _Builder · Core platform · effort M · after P2-03, P2-08, P2-10, P0-32_  
  Versioned price items (procedure, 'from' price or range, currency, branch, validity) and location facts (address, hours, parking, directions), editable only with 'approve prices' and audited. The get_price tool, the lint and quotes read only approved, unexpired items by ID.  
  **Done when:** The signed price list is loaded on staging, the API never returns expired or unapproved items, and every change shows an approver in the audit log.
- [ ] **P2-15** ⚑ Load organisation 1's staff, roles, rota and SLA ladder and send invitations  
  _Both · Core platform · effort S · after P2-08, P2-11, P1-24 · needs Q4_  
  The builder loads the P1-24 roster and permission matrix through the provisioning script; no personal contact data goes into the repo.  
  **Done when:** Every staff member has a pending invitation on staging with the signed role and permission settings.
- [ ] **P2-16** ⚑ Build rota-based assignment with shifts, on-call and reassignment  
  _Builder · Core platform · effort M · after P2-15, P2-08 · needs Q4_  
  Shift calendar per branch and role, availability toggle, round-robin or least-open-tasks, language matching to staff skills, and on-call then manager when nobody is on shift. Manual reassignment needs a reason, and a fairness report shows the spread.  
  **Done when:** Unit tests cover nobody on shift, all on break and ties, organisation 1's rota is on staging, and an out-of-hours test lead goes to on-call.
- [ ] **P2-17** ⚑ Build the notification service core: routing, web push and email, delivery log, acknowledgement  
  _Builder · Core platform · effort M · after P2-02, P2-03, P2-08, P2-16, P2-05_  
  A queue-backed notify() routes by role and person rules and preferences, dedupes, logs every delivery with provider callbacks, and sends a deep link instead of personal data. An 'acknowledge' action stops SLA escalation; SMS/WhatsApp fallback and bundling follow in P3-04.  
  **Done when:** Integration tests show routing, dedupe and acknowledgement stopping escalation, and admins see the delivery log on staging.
- [ ] **P2-18** ⚑ Build the UI foundation with Playwright and accessibility checks in CI  
  _Builder · Core platform · effort M · after P0-36, P0-37_  
  packages/ui components with light/dark themes and org brand colours, ICU message strings, org timezone and currency formatting, an RTL-ready layout and a WCAG 2.2 AA target. Add Playwright e2e and axe-core to CI.  
  **Done when:** A pseudo-locale build shows no hard-coded strings, axe-core reports zero serious violations on every screen, core flows work keyboard-only, and a CI job that renders every route at 360 px and 768 px and fails on horizontal scroll or clipped controls runs on every PR.
- [ ] **P2-19** ⚑ Ship the installable PWA shell and web push, including iOS home-screen apps  
  _Builder · Core platform · effort M · after P2-17, P2-06, P2-18_  
  Branded manifest, install guides for iOS (push only for home-screen apps on iOS 16.4+) and Android, a service worker caching only the app shell, VAPID keys as secrets, per-device subscriptions removed on logout, permission prompts only on tap, and deep-linking notifications.  
  **Done when:** Lighthouse reports installable, a test push deep-links on a real installed iPhone (iOS 16.4+) and an Android phone, and logout stops pushes.
- [ ] **P2-20** ⚑ Build the channel gateway Worker: per-workspace webhook routes, fast ack, encrypted archive, enqueue  
  _Builder · Channels & AI replies · effort M · after P0-38, P0-35, P2-02_  
  Routes /webhooks/{instagram|tiktok|partner|whatsapp}/:workspaceId read the raw body once, verify it, write it encrypted to R2 under a per-workspace prefix with the short lifecycle from the retention schedule, enqueue a pointer and return 200 before processing (verify Meta's timeout and retry rules). The archive is covered by erase/DSAR, and unknown workspaces return 404 with an alert.  
  **Done when:** A load test of 50 POSTs/s for 5 minutes gets 200 on every request with p95 under 300 ms, and each payload is in R2 and the queue.
- [ ] **P2-21** ⚑ Redact payment card numbers from inbound messages before storage, AI and logs  
  _Builder · Channels & AI replies · effort S · after P2-20_  
  Detect card-like numbers (Luhn plus context) and CVV/expiry patterns in DMs, transcripts and comments before archiving, and redact them in D1, R2, logs, push payloads and Claude requests. Reply with the approved 'we never take card details here' wording and alert the coordinator.  
  **Done when:** A test DM with a test card number is stored redacted everywhere and the approved reply and alert both fire.
- [ ] **P2-22** ⚑ Implement Instagram webhook verification and X-Hub-Signature-256 checks with per-workspace secrets  
  _Builder · Channels & AI replies · effort S · after P2-20, P0-25, P0-26_  
  Store each workspace's app secret and verify token encrypted in D1 (envelope key as a Worker secret) and look them up by route. GET echoes hub.challenge only on a matching token; POST compares HMAC-SHA256 of the raw body in constant time and returns 401 without enqueueing on mismatch; subscribe the needed fields on the staging and production apps.  
  **Done when:** 'Verify and save' succeeds for staging and production callbacks, a dashboard test event is stored once, and a forged signature gets 401.
- [ ] **P2-23** ⚑ Connect Instagram via OAuth and automate token storage, refresh and expiry alerts  
  _Both · Channels & AI replies · effort M · after P2-22, P2-06, P2-05_  
  The organisation's Instagram admin completes business login from a minimal admin page; tokens are AES-GCM encrypted in D1 and never logged. Check the flow's current lifetime and refresh rules, refresh from a cron well before expiry, and run a daily health check that alerts the builder and org admin (by email until notifications exist).  
  **Done when:** A forced refresh succeeds unattended, a revoked token triggers an alert within 24 h, and log scans find no token strings.
- [ ] **P2-24** ⚑ Build the Instagram Send API client and prove a staging round trip  
  _Builder · Channels & AI replies · effort M · after P2-23_  
  Text, quick replies, approved media, mark_seen and typing_on, with typed errors (window closed, user unavailable, permission, throttling), backoff with jitter only on retryable errors and a per-account token bucket in a Durable Object (verify rate limits). Every call goes through the send gate.  
  **Done when:** A tester DM reaches staging and a reply is delivered within 24 h with both message IDs logged, and a simulated window-closed error is not retried.
- [ ] **P2-25** ⚑ Normalise Instagram webhook events into one channel-agnostic message schema  
  _Builder · Channels & AI replies · effort M · after P2-20, P2-03_  
  Subscribe to messages, postbacks, echoes, reactions and seen (comments only if that permission is requested), verifying field names and that story mentions and replies arrive as messages. Map to workspace, channel, thread, platform id, sender type (user, staff echo, AI), text, attachments, story/post/ad reference and timestamps; an unsend redacts the stored text.  
  **Done when:** A fixture library of real staging payloads covering every event type parses to the expected rows with all tests passing.
- [ ] **P2-26** ⚑ Add idempotency, per-conversation ordering and burst debounce  
  _Builder · Channels & AI replies · effort M · after P2-25_  
  A unique index on (channel, platform_message_id) makes retries produce one row; a Durable Object per conversation processes in order with a tunable debounce (start 4-8 s) so quick bursts get one reply. Per-inbound processing state ensures a crash never causes a second send.  
  **Done when:** The same webhook delivered 3 times yields one row and at most one reply, and four messages within 5 s produce exactly one draft.
- [ ] **P2-27** ⚑ Set up dead-letter queues, DLQ alerts and a replay tool  
  _Builder · Channels & AI replies · effort S · after P2-20, P2-26_  
  Max retries and a DLQ on every queue, an alert whenever a DLQ is non-empty, and an authenticated replay by message id, conversation or time range from the R2 archive through the same idempotent path.  
  **Done when:** A malformed payload lands in the DLQ and alerts, and after the fix a replay processes it exactly once.
- [ ] **P2-28** ⚑ Specify consent capture, evidence and withdrawal per channel and purpose  
  _Both · Legal & compliance · effort M · after P0-13, P1-39 · needs Q1, Q5, Q7_  
  A matrix of purposes (service replies, reminders, WhatsApp, SMS, marketing, aftercare, reviews and referrals, win-back, recording, photo use) against channels, with lawful basis, opt-in wording per language, evidence fields (person, channel, purpose, wording version, timestamp, source, staff member) and withdrawal routes. Sharing a number for a callback is not WhatsApp opt-in.  
  **Done when:** The matrix and wording are approved and the data fields are handed to the consent-log build.
- [ ] **P2-29** ⚑ Build the consent log and do-not-contact store  
  _Builder · Core platform · effort M · after P2-03, P2-28 · needs Q1, Q7_  
  Record consent per person, channel and purpose with the matrix's evidence fields, captured from the AI DM flow, call outcomes, bookings, imports and forms. Withdrawal by STOP, DM or verbal request takes effect immediately and is exposed as one check used by the send gate.  
  **Done when:** Each consent row shows wording version, source and timestamp, and a withdrawn or do-not-contact person fails the consent check on every channel in tests.
- [ ] **P2-30** ⚑ Build the window tracker and the single send gate, including the manual kill switch  
  _Builder · Channels & AI replies · effort M · after P2-25, P2-06, P2-29_  
  One function decides every outbound message from AI, staff, MCP, rules, reminders and campaigns: Instagram free-form within 24 h; HUMAN_AGENT only for staff-typed text with no draft id between 24 h and 7 days; TikTok within 48 h and at most 10 per user message; WhatsApp templates after 24 h; plus consent and do-not-contact, first-message disclosure, under-18 and clinical pause flags, and a per-workspace/per-channel kill switch checked at send time. With the window closed the AI stays silent and, if a number was shared, a call task is raised.  
  **Done when:** Boundary tests pass (23h59 vs 24h01, 7 days, 48 h, 10th vs 11th TikTok message), a draft-derived HUMAN_AGENT send is rejected and audited, the kill switch stops AI sends within 30 s, and a test proves every outbound path calls the gate.
- [ ] **P2-31** Ingest attachments into R2 without sending images to Claude  
  _Builder · Channels & AI replies · effort M · after P2-25_  
  Download media promptly (verify CDN URL lifetimes) into R2 with hash, MIME and size checks and show it via short-lived signed URLs. Inbound images and video are never sent to Claude; they trigger staff review with a holding line, and outbound media comes only from an approved library.  
  **Done when:** Image, video, audio and file from a tester are viewable 24 h later, and a test photo produces a handoff with no Claude call.
- [ ] **P2-32** ⚑ Implement AI-human handover, per-conversation AI pause and an always-available 'talk to a person' path  
  _Builder · Channels & AI replies · effort M · after P2-25, P2-30, P2-17_  
  States ai_active, needs_human, human_active, ai_paused and closed with audit, triggered by the engine's handoff flag, a staff 'Take over', a staff echo from the native app, or the user asking for a person (always offered as a quick reply). The AI resumes only on staff action and restates the disclosure; handoffs notify staff.  
  **Done when:** A test script drives each trigger, and after a staff echo no draft or send happens until 'Resume AI', whose message contains the disclosure.
- [ ] **P2-33** ⚑ Build the reply engine Worker on the Claude API  
  _Builder · Channels & AI replies · effort M · after P2-26, P0-12, P0-39_  
  Each inbound DM is a fresh claude-opus-5-5 request with the transcript rendered as data in the user turn, so earlier thinking blocks are never replayed (preserved thinking is enforced for accounts created on or after 31 Aug 2026); within one reply the tool loop is append-only with thinking blocks passed back unchanged. Set output_config.effort explicitly (default is medium and thinking cannot be disabled), use no prefill, enable server-side fallbacks ('default', verify the beta header), keep the key in Workers secrets, and log request id, model, effort, tokens, cache reads, latency and cost.  
  **Done when:** An inbound staging DM produces a stored draft at p95 under 15 s with every usage field logged.
- [ ] **P2-34** ⚑ Load the signed guardrail content into versioned config  
  _Builder · Channels & AI replies · effort S · after P1-25, P1-26, P1-27, P1-28, P1-29, P2-14 · needs Q6_  
  Package the Legal-approved claims, banned-phrase and medicine lists, minors, disclosure and escalation wording, plus the organisation's payment wording (payment links after the call, never card details in a DM), into versioned config read by the guardrail layer, with prices from the price store.  
  **Done when:** The config carries approver names and dates, loads in the guardrail layer, and a change without approval fails CI.
- [ ] **P2-35** ⚑ Assemble the prompt from the active playbook version with prompt caching  
  _Builder · Channels & AI replies · effort M · after P2-33, P1-34, P2-34_  
  Fixed order tools, then system (rules, disclosure, playbook, price list), then messages, with cache breakpoints after the stable prefix and no timestamps or unsorted JSON inside it. Per-turn context (window, hours, stage) goes after the prefix as a mid-conversation system message, and each draft records its playbook version.  
  **Done when:** A 100-message staging run shows cache reads on later turns with a hit ratio of at least 80% and every draft linked to its playbook version.
- [ ] **P2-36** ⚑ Define strict tool schemas and the structured reply contract  
  _Builder · Channels & AI replies · effort M · after P2-33, P2-14_  
  Tools get_lead, get_price (approved items only), get_playbook_section and flag_handoff with strict: true, tenant and conversation ids bound server-side, and tool_choice auto (forced tool_choice returns 400 on Opus 5.5); get_availability ships disabled until P4-04 so the AI never offers slots. Output via output_config.format (reply_text, language, intent, lead_score, confidence, handoff, risk flags, detected_contact, disclosure_included), or a strict submit_reply tool if format and tools do not combine (verify).  
  **Done when:** 100% of eval outputs parse against the schema and a unit test proves a tool call cannot reach another workspace or conversation.
- [ ] **P2-37** ⚑ Handle refusals, API errors and timeouts so nothing bad or partial is sent  
  _Builder · Channels & AI replies · effort S · after P2-33, P2-32_  
  Check stop_reason (refusal, max_tokens) before reading content, retry 429/5xx with typed SDK errors and open a circuit breaker after repeated failures. On final failure nothing is sent; the chat moves to needs_human with a reason, plus at most one pre-approved holding line if the window is open.  
  **Done when:** Chaos tests for a 500, a timeout, a refusal and malformed JSON each end with no AI message, the chat in needs_human and an alert counter incremented.
- [ ] **P2-38** ⚑ Implement deterministic output guardrails before every send  
  _Builder · Channels & AI replies · effort M · after P2-36, P2-34 · needs Q1, Q2_  
  Check disclosure on the first AI message and after take-back, banned phrases and claims (normalised, multilingual), every amount matching a price item, no card-detail request, no staff name as sender, allowlisted links only, no booking language under the minor flag, and length. On failure regenerate once with the violation as feedback, then hand off; log every block.  
  **Done when:** A suite of at least 100 cases passes and zero violations reach the send gate across the eval set.
- [ ] **P2-39** ⚑ Build inbound risk detectors: clinical, minor, complaint and spam  
  _Builder · Channels & AI replies · effort M · after P2-34, P1-32, P2-32 · needs Q1, Q2_  
  Combine model flags with rules on inbound text. Clinical topics (suitability, side effects, medication, pregnancy, conditions) go to the clinical route; a stated age under 18, school year or birth year starts the under-18 flow; complaints and distress hand off; spam skips the model; thresholds favour recall.  
  **Done when:** Clinical and minor recall are at least 98% and spam false positives at most 1% on the adversarial set, and flagged staging chats show the right state and alert.
- [ ] **P2-40** ⚑ Harden the reply engine against prompt injection and mask PII in logs  
  _Builder · Channels & AI replies · effort M · after P2-36, P1-40_  
  User text appears only in user turns, labelled untrusted; tools are read-only except flag_handoff and scoped server-side; outputs never reveal the prompt or other clients' data. Phones, emails and names are masked in logs, analytics and eval exports, and a red-team suite of at least 50 attacks runs in CI.  
  **Done when:** The red-team suite passes 100% in CI and a 1,000-line log sample contains no unmasked phone number or email.
- [ ] **P2-41** ⚑ Build the client record UI with identities and an episode timeline  
  _Builder · Core platform · effort M · after P2-13, P2-12_  
  Profile header, linked identities, consent and do-not-contact flags, tags and custom fields, and episodes with timelines of conversations, stages, tasks, calls and notes. A new episode opens only when no episode is active (completed or closed, or after a configurable gap); duplicates are flagged for the P4 merge wizard.  
  **Done when:** A masked role sees masked identities, a message from a mid-treatment client attaches to the active episode, and one from a closed client opens a new episode.
- [ ] **P2-42** ⚑ Build tasks and call logging with tap-to-call and one-tap outcomes  
  _Builder · Core platform · effort M · after P2-13, P2-41_  
  'My tasks' with due and overdue items and SLA timers, tap-to-call via tel: link recording call start, and one-tap outcomes: booked (date, procedure, branch, and the agreed payment or deposit timing and method), call back at a time, not interested, no answer, voicemail, wrong number. Staff can also log an inbound call against a lead found by caller number or handle. Call recording stays off in this release and is built later only if the organisation opts in.  
  **Done when:** On a phone, tapping a task opens the dialler and returning prompts for the outcome; a 'booked' outcome cannot be saved without the date and agreed payment timing, the outcome is stored with the task, and an inbound call can be logged against an existing lead.
- [ ] **P2-43** ⚑ Seed the default journey pipeline with stage history, side exits and the under-18 rule  
  _Builder · Core platform · effort M · after P2-13, P2-10_  
  Stages from DM received to Alumni plus side exits (spam, nurture, not a fit, under 18, duplicate, no answer x3, lost with reason, reschedule, cancelled/refund, partial refund, no-show, not suitable, declined, paused, thinking it over, accepts part of plan, existing client, clinical escalation, complaint, do-not-contact, erase). Moves outside allowed transitions need an override reason, but no override can move an under-18 lead towards booking; the editor and board follow in P4-23.  
  **Done when:** The pipeline is seeded on staging, every move writes stage history and an audit row, and an under-18 lead cannot be moved forward by any role.
- [ ] **P2-44** ⚑ Implement SLA clocks and escalation ladders with business hours  
  _Both · Core platform · effort M · after P2-17, P2-15, P2-42 · needs Q4_  
  Default: number shared means call within 15 min, manager at 15, owner at 60; AI unsure, complaint or possible minor goes to the on-duty coordinator with the manager at 10. Timers use Durable Object alarms, stop on acknowledgement or a logged call, follow business hours and allow per-case changes with a reason; clinical flags use the clinician route (P2-45).  
  **Done when:** Fake-clock tests show the 15 and 60 min escalations firing once and stopping on acknowledgement, and a staging drill on real phones escalates coordinator to manager to owner.
- [ ] **P2-45** ⚑ Set up the clinical escalation route: clinician queue, on-duty clinician and urgent path  
  _Both · Core platform · effort M · after P2-44, P2-17, P2-15, P0-06 · needs Q2, Q4_  
  Clinical and suitability questions and post-treatment symptoms go to a clinician queue with an on-duty clinician and SLA, an approved holding message, and a 24/7 urgent path (approved 'seek urgent care now' text plus an immediate call alert). Replies come from a named clinician writing as themselves; the organisation names clinicians, cover hours and SLA.  
  **Done when:** A clinical DM and an urgent-symptom DM each reach the on-duty clinician within 60 s with the right text sent, both escalate when unacknowledged, and the lead clinician signs off the route.
- [ ] **P2-46** ⚑ Ship the hard-coded contact-captured handoff flow  
  _Builder · Core platform · effort M · after P2-16, P2-17, P2-42, P2-44, P2-43_  
  On contact.captured: create or merge the lead, move it to Contact captured, assign by rota, create a call task, notify and start the SLA clock; a closed window on a lead with a number also creates a call task. Staff can also create a lead by hand for enquiries that do not start in a DM (an inbound call to the public number, a walk-in, a referral, another channel): a short form takes source, name, phone and any consent given, warns on a matching phone, email or handle, and emits contact.captured so the same flow applies. Three logged no-answers move the lead to nurture (WhatsApp or SMS follow-up only with recorded consent); the generic rules engine comes in P4-21.  
  **Done when:** An injected contact.captured produces lead, assignment, task, push and SLA timer within 10 s, replaying it creates no duplicates, three no-answers move the lead to nurture, and a hand-created lead from an inbound call gets the same assignment, task and timer with its source recorded and a duplicate warning when the phone already exists.
- [ ] **P2-47** ⚑ Detect phone numbers and contact requests and fire the coordinator handoff  
  _Builder · Channels & AI replies · effort M · after P2-33, P2-46, P2-34, P0-31 · needs Q1, Q7_  
  Deterministic parsing (libphonenumber with the org's default region, plus spaced, obfuscated and spelled-out numbers) and intent detection for 'what's your number' or 'call me', normalised to E.164 and emitting contact.captured. When the person asks for the organisation's number without giving theirs, the reply gives the approved public number and invites them to share their own; the event then carries no phone, so the lead is created and assigned with an 'expecting their call' task and no outbound SLA clock, and it becomes a normal call task with the clock as soon as a number arrives by DM or an inbound call is logged against it. Replies never pretend to be a named staff member.  
  **Done when:** On a 300-message corpus phone recall is at least 99% with at most 1% false positives from prices and dates, a staging DM with a number creates the lead and a coordinator push within 60 s, and a staging DM asking for the organisation's number without giving one gets the public number, creates an assigned lead with an 'expecting their call' task and no SLA clock, and switches to a call task with the clock when a number follows.
- [ ] **P2-48** ⚑ Build Durable Objects for the live inbox feed and conversation locks  
  _Builder · Core platform · effort M · after P2-02, P2-06_  
  An InboxHub per org uses WebSocket Hibernation to push messages, drafts, assignments, locks and SLA events filtered by permission, with since-cursor catch-up from D1. A ConversationLock per conversation provides claim/release with TTL, shows who is replying and holds the per-conversation AI-paused flag (verify DO limits).  
  **Done when:** In a two-browser test a new message appears in both in under 1 s, a second user is blocked while the lock is held, the lock expires on TTL, and reconnects miss nothing.
- [ ] **P2-49** ⚑ Build the unified inbox: list, filters and thread view  
  _Builder · Core platform · effort M · after P2-13, P2-48, P2-18_  
  One mobile-first list for Instagram and TikTok with channel badges, filters (unassigned, mine, needs human, number shared, stage, channel, branch, unread), a reply-window countdown and the source post or ad. The thread view shows media, internal notes and assignment, with live updates.  
  **Done when:** Playwright tests on seeded data pass for every filter, live arrival and countdown, and the inbox works at 360 px with no horizontal scroll.
- [ ] **P2-50** ⚑ Build the reply composer: co-pilot drafts, edit and send, take-over and kill switch  
  _Builder · Core platform · effort M · after P2-49, P2-48, P2-33, P2-30, P2-24, P2-32_  
  Shows the draft with intent, score, confidence, flags and countdown, with Send, Edit & send (diff stored against the draft id), Discard with reason, Take over and the kill switch for permitted roles. Between 24 h and 7 days drafts are hidden and only staff-typed text may go under HUMAN_AGENT. Manual-assist capture for channels without an API is built separately in NEW-4.  
  **Done when:** Against a mocked gateway, e2e tests pass for send, edit, discard with reason, take-over, resume with disclosure and kill switch, and a send into a closed window is blocked with an explanation.
- [ ] **P2-51** ⚑ Build manual-assist capture: paste an inbound DM, draft, copy and mark as sent  
  _Builder · Channels & AI replies · effort M · after P2-49, P2-33, P2-30, P2-32_  
  For channels without an API (region-blocked TikTok, or the Instagram contingency in P0-30), staff paste the inbound DM with handle and time, get a draft with disclosure, copy it, send it natively and tap 'Mark as sent'. The window countdown runs from the pasted time, and the send gate (window, kill switch, consent, under-18 and clinical flags) is checked before a draft is offered. Split from P2-50 so it does not depend on the Instagram Send API or OAuth and is ready by the week-7 contingency trigger.  
  **Done when:** E2E tests pass for paste, draft, copy and mark-sent with the countdown running from the pasted time, a paste into a closed window gets no draft, and the conversation appears in the inbox and pipeline tagged 'manual'.
- [ ] **P2-52** ⚑ Build the App Review demo slice on production by week 5  
  _Builder · Channels & AI replies · effort M · after P2-22, P2-23, P2-24, P2-06, P2-07, P2-33, P0-21 · needs Q8_  
  A thin path reviewers can test without the full inbox: signed webhook, stored message, a reviewer screen showing the DM and an AI draft with disclosure, staff Send, Take over, and a blocked send after 24 h. The reviewer login sees only tester and reviewer conversations and has TOTP pre-enrolled.  
  **Done when:** Every reviewer-instruction step passes on production with a tester account, and a 5-minute uptime check on the webhook is live and green (it must stay green through review, tracked in P2-55).
- [ ] **P2-53** ⚑ Write the Meta App Review submission and the platform policy checklist  
  _Both · Accounts & approvals · effort M · after P0-25, P0-21, P0-12, P0-10, P0-14 · needs Q8_  
  Use case per permission (lead DMs, AI drafts with disclosure, staff sending, human takeover, 24 h window), reviewer steps and logins, and data-handling answers (Anthropic and Cloudflare as processors, locations, deletion), plus comments and HUMAN_AGENT if decided in P0-25. Map each platform-policy item (24 h rule, HUMAN_AGENT human-only, path to a human, disclosure, no scraping, deletion URL) to a config, test or evidence.  
  **Done when:** The submission text and checklist are in the repo, reviewer logins are in the vault, and the owner has approved the wording.
- [ ] **P2-54** ⚑ Record the App Review screencast against the demo slice  
  _Both · Accounts & approvals · effort S · after P2-52, P2-53 · needs Q8_  
  The user records and the organisation's Instagram admin performs the login consent on camera: a tester DM arriving, the AI draft with disclosure, staff send, take-over, and a blocked send outside 24 h, with captions.  
  **Done when:** The captioned screencast is attached to the submission and every step was re-tested on production the same day.
- [ ] **P2-55** ⚑ Submit Meta App Review and obtain Advanced Access (target submission week 5)  
  _Both · Accounts & approvals · effort S · after P0-24, P2-53, P2-54 · needs Q8_  
  Submit once Business Verification shows Verified, check the dashboard and admin alias daily, and fix and resubmit any rejection within 2 working days; expect 1-3 weeks including one rejection round. Keep the demo slice, reviewer logins and testers working throughout; the Live switch happens at shadow go-live (P3-09).  
  **Done when:** The dashboard shows Advanced Access for every permission recorded in P0-25 (with Instagram Login: instagram_business_basic and instagram_business_manage_messages; with Facebook Login the instagram_basic, instagram_manage_messages and Pages set), plus the Human Agent feature or instagram_business_manage_comments if requested.
- [ ] **P2-56** ⚑ Build the eval harness and make it a blocking publish gate  
  _Builder · Channels & AI replies · effort M · after P1-32, P1-33, P2-33, P2-35, P2-38_  
  Run the engine (given playbook, prompt and model) over the eval sets inside a Worker in the organisation's account, so CI sees scores only and eval data stays in R2. Score with deterministic checks plus a Claude judge using the rubric, calibrated against the 50 staff-graded items; run on every prompt, playbook, guardrail, tool or model change, and nightly via the Batch API with a spend cap.  
  **Done when:** Playbook v0 has a scorecard with zero guardrail failures, the judge agrees with staff on at least 80% of calibration items, and a PR adding a banned phrase fails the required check.
- [ ] **P2-57** ⚑ Fix numeric go/no-go criteria for shadow to co-pilot and co-pilot to autopilot  
  _Both · Launch & operations · effort S · after P1-33 · needs Q9_  
  Agree the minimum rated pairs per intent and language (e.g. at least 200 total), the share rated as good as or better than staff, zero-tolerance categories (clinical advice, booking a minor, invented price, missing disclosure, out-of-window send, HUMAN_AGENT misuse), per-intent unedited-send rates and handoff recall for autopilot, the measurement window and the signatories.  
  **Done when:** The owner and privacy lead have signed a criteria document with a number for every threshold.
- [ ] **P2-58** ⚑ Build shadow mode: a draft for every DM paired with the staff reply, plus blinded rating  
  _Builder · Channels & AI replies · effort M · after P2-33, P2-25, P2-49, P2-30_  
  In shadow the engine drafts every DM and the send gate blocks all AI sends; each staff reply (app or native echo) is paired with its draft. A reviewer screen shows both in blinded random order, collects better/same/worse with a reason and feeds daily metrics; until Advanced Access it runs on testers and the eval sets.  
  **Done when:** On staging with tester traffic at least 95% of inbound DMs have a paired draft and reply, and the dashboard shows ratings by intent.
- [ ] **P2-59** Tune model and effort per route and record the decision  
  _Both · Channels & AI replies · effort S · after P2-56 · needs Q4_  
  Run the eval sets on claude-opus-5-5 at low, medium and high effort, and on claude-sonnet-5-5 only if the owner wants to trade quality for cost. Compare quality, p95 latency and cost per reply against the ~$0.02-0.03 estimate and pick an effort per route.  
  **Done when:** The owner approves a decision record with a score/latency/cost table and the settings are in config.
- [ ] **P2-60** Publish approved Playbook v1 with rollback to v0  
  _Builder · History & playbook · effort S · after P1-37, P2-56, P2-35_  
  Freeze the signed text in D1 with version hash, changelog and approvals once it passes the eval gate, and mark it active. Keep v0 as the one-click rollback; if v1 is late, shadow and co-pilot proceed on v0.  
  **Done when:** Staging drafts log v1's hash, and a rollback to v0 takes effect within one message cycle.
- [ ] **P2-61** Seed live client records from matched history  
  _Builder · History & playbook · effort M · after P1-13, P2-03, P0-20, P1-39 · needs Q3_  
  Load confirmed handle-to-client matches (identities, past episode dates and outcomes, marketing consent unknown, no message bodies) so returning clients are recognised at go-live. The privacy lead first confirms the LIA and ROPA cover this purpose.  
  **Done when:** A staging DM from a matched handle opens the existing client with prior episodes, and the privacy lead's approval is filed.
- [ ] **P2-62** ⚑ Give privacy information at the point of collection in DMs and on profiles  
  _Both · Legal & compliance · effort S · after P1-41, P1-28 · needs Q7_  
  Add a short privacy line and link to the first AI message or the number-capture acknowledgement in every language and within length limits, and add the privacy link and an 'assisted by AI' note to each channel's profile.  
  **Done when:** The wording is in versioned config, tests show it at first message and number capture, and profile screenshots are filed.
- [ ] **P2-63** ⚑ Document how the deployment meets Anthropic's high-risk healthcare safeguards  
  _Builder · Legal & compliance · effort S · after P1-30, P1-28, P1-27_  
  Check the current Usage Policy and Anthropic's guidelines for organisations whose products may be used by minors (under-18s will DM before their age is known), and record how each requirement is met: AI limited to logistics, prices and booking; no medical advice or suitability judgements; qualified human review of anything clinical; AI disclosure; the under-18 stop and data minimisation (P1-27); audit log and nightly QA. Name the non-clinical intents allowed on autopilot.  
  **Done when:** A dated record names the policy version checked, maps each requirement to a feature or test, and is approved by the privacy lead.
- [ ] **P2-64** ⚑ Write the data subject request procedure  
  _Both · Legal & compliance · effort S · after P1-40, P1-41 · needs Q1_  
  Intake channels (DM, email, phone), identity checks, deadlines (one month under GDPR; verify), export format, erase exceptions (clinical retention, legal claims), merged duplicates and past episodes, what cannot be deleted on Instagram/TikTok and how the person is told, logging and approval.  
  **Done when:** The runbook is approved, the request type and log fields are specified, and the privacy notice links to it.
- [ ] **P2-65** Detect opt-out, do-not-contact and data-rights requests in DMs  
  _Builder · Channels & AI replies · effort S · after P2-29, P2-39, P2-64 · needs Q7_  
  Classify 'stop messaging me', 'delete my data' or 'what do you hold on me' in every language; set do-not-contact or open a DSAR task, acknowledge with approved wording and pause the AI for that person.  
  **Done when:** Recall is at least 98% per language on the labelled set and staging tests show the flag or DSAR task created with AI paused.
- [ ] **P2-66** Route DMs from existing clients to their active episode under an existing-client policy  
  _Builder · Channels & AI replies · effort M · after P2-41, P2-45, P2-33_  
  Match the handle to a client; if an episode is active, attach the message and notify the assigned coordinator or front desk. The AI helps with logistics and rescheduling only, asks no sales questions, and sends aftercare or symptom questions to the clinical route.  
  **Done when:** Current-client eval cases produce no sales questions, staging DMs attach to the active episode, and a symptom message reaches the clinician queue.
- [ ] **P2-67** ⚑ Build export, erase and retention jobs across every store, plus the Meta deletion callback  
  _Builder · Core platform · effort M · after P2-03, P1-40, P2-64, P2-10, P2-22_  
  Per-person export (JSON plus files) and erase/anonymise across D1, R2 (attachments, forms, photos, webhook archive), Durable Object state, queues and DLQs, search rows, logs and history tables, with clinical-retention and legal-hold exceptions and backups ageing out; test end to end on a synthetic person with two channels, a merged duplicate, two episodes and a do-not-contact flag. Meta's data-deletion and deauthorize callbacks verify signed_request and return a status URL and confirmation code, but they fire only for app users (the connected professional account or testers), not for people who DM, so they disconnect that account, revoke its tokens and delete what the platform terms require; lead erasure stays on the DSAR path (P2-64).  
  **Done when:** The privacy lead signs a test report showing a complete export, nothing left after erase beyond listed exceptions, expired data removed, and a Meta signed_request running to completion.
- [ ] **P2-68** ⚑ Sign DPAs and run policy checks for messaging and notification providers  
  _Both · Legal & compliance · effort S · after P2-28, P1-45, P1-46, P2-05 · needs Q5_  
  Sign or accept DPAs for the WhatsApp Business Platform, SMS, email and push providers and add them to the register. Notifications carry no health details on lock screens, and WhatsApp use stays business-specific (booking and support, not a general assistant) with opt-in and approved templates outside 24 h.  
  **Done when:** DPAs are on file, notification content rules are approved and the WhatsApp policy checklist is signed.
- [ ] **P2-69** ⚑ Build the WhatsApp Cloud API and SMS adapters with staff-alert templates and opt-out handling  
  _Builder · Core platform · effort M · after P1-45, P1-46, P2-17, P2-30, P2-29, P2-68 · needs Q1, Q5_  
  A system-user token with messaging permissions, staff-alert templates submitted as utility (verify Meta accepts that category for internal alerts, since a template recategorised as marketing gets per-user caps and may not deliver in some countries), signature-checked status webhooks, E.164 validation, per-message cost tracking, and STOP handling that sets do-not-contact. Every send passes the send gate, and P4 client reminders reuse these adapters.  
  **Done when:** A staging escalation delivers a WhatsApp alert and an SMS to an opted-in staff phone with delivery status logged, the templates show Approved, and STOP blocks further sends.
- [ ] **P2-70** ⚑ Set the call-recording policy and the coordinator notice script  
  _Both · Legal & compliance · effort S · after P0-13, P0-31 · needs Q1, Q5_  
  Recording is off by default; if ever enabled, script the opening notice, check all-party consent rules where clients are (verify), define what happens when a caller refuses, and set access and retention for recordings, transcripts and AI call briefs.  
  **Done when:** The policy and script are approved, a config test shows recording off by default, and the script is in the coordinator SOP.
- [ ] **P2-71** ⚑ Write the incident and breach response plan  
  _Both · Legal & compliance · effort M · after P0-13, P0-14, P2-30 · needs Q1, Q2_  
  Roles and contacts (organisation, operator, Anthropic, Cloudflare, platforms), severity levels, the 72-hour authority notice under GDPR/UK GDPR, notifying individuals, HIPAA rules if applicable (verify), processor-to-controller timings, AI incidents (kill switch, review, notify), platform enforcement, evidence preservation and a breach log.  
  **Done when:** The privacy lead approves the plan, the contact sheet and breach log exist, and staff know how to report incidents.
- [ ] **P2-72** ⚑ Issue the staff confidentiality, device and monitoring policies and collect signatures  
  _Both · Legal & compliance · effort S · after P0-06, P2-09, P1-42, P2-06 · needs Q1, Q4_  
  Cover confidentiality, company vs personal phones and minimums (OS version, screen lock, 2FA, no shared logins), no screenshots or forwarding client data, no pasting into other AI tools, payment links only, no impersonation, escalation, and reporting a lost device within 1 hour. The monitoring notice says what is logged (audit, AI QA, speed metrics, MCP); verify employment-law consultation duties.  
  **Done when:** Both documents are approved, every user signs before activation, and a lost-device drill revokes a test user's sessions within 5 minutes.
- [ ] **P2-73** ⚑ Build the workspace admin console  
  _Builder · Core platform · effort M · after P2-08, P2-10, P2-16, P2-23_  
  Invite and offboard users (offboarding revokes sessions and tokens, reassigns leads and removes them from the rota), tick permissions, edit hours, rota and escalation ladders, connect or reconnect Instagram, TikTok and WhatsApp, and set AI mode per channel. Every change is audited and permission changes need step-up.  
  **Done when:** On staging the owner, unaided, invites a user, changes a permission, edits the ladder, reconnects Instagram and offboards a test user whose sessions stop at once.
- [ ] **P2-74** ⚑ Set up automated backups, a restore drill and per-organisation export  
  _Builder · Core platform · effort M · after P0-38, P2-03_  
  Check D1 Time Travel on the plan, export every D1 nightly to an encrypted, versioned R2 backup bucket (object lock if available), keep 35 nightly and 12 monthly backups, and version attachment buckets. The owner can download a full per-org export behind step-up.  
  **Done when:** A nightly staging backup restores into a scratch DB with matching row counts and recorded RTO/RPO, docs/runbooks/restore.md exists, and a per-org export downloads.
- [ ] **P2-75** ⚑ Instrument logs, metrics, error tracking, uptime, token-expiry and spend alerts  
  _Builder · Core platform · effort M · after P0-38, P2-17, P0-14_  
  JSON logs with ids but never message bodies or phone numbers (tested redaction), Workers Logs or Logpush, and Analytics Engine metrics (latency, queue lag, DLQ depth, sockets, SLA breaches, webhook and notification failures, cron success). Sentry only once it is in the register with a DPA and region, otherwise Cloudflare-only; synthetic checks hit webhook, app and health every 5 minutes, with alerts for token expiry 7 days ahead and spend over threshold.  
  **Done when:** A staging error reaches tracking within 2 minutes with no PII, a queue-backlog drill and a fake token expiry each page within 5 minutes, and redaction tests pass.
- [ ] **P2-76** ⚑ Harden the platform: OWASP controls, rate limits, code scanning and key rotation  
  _Builder · Core platform · effort M · after P2-06, P2-13, P2-04_  
  Nonce-based CSP, HSTS, frame-ancestors none, CSRF protection, a CORS allow-list, zod validation, an SSRF guard, type-sniffed size-limited uploads to private R2, and per-IP/user/org rate limits on auth, API and MCP. Add CodeQL and a dependency audit, and give signing keys ids so they rotate per docs/secrets.md without logging users out.  
  **Done when:** Staging scores A on a headers scan, rate-limit tests return 429, rotating the session key logs nobody out, and CodeQL shows no high or critical findings.

## P3 · Instagram shadow, co-pilot and autopilot; TikTok (7-13 (roadmap: shadow/co-pilot 7-9, autopilot 10; realistic autopilot 11-13; TikTok 8-11 depending on route))

Exit criteria:

- Shadow live on production about week 7 with zero AI sends; shadow gate signed
- UAT, training and security review signed; co-pilot live about week 9
- Two weeks of hypercare completed and signed
- Autopilot gate signed and the first intent set running on autopilot with metrics within bounds
- TikTok live on the chosen route (API, partner or manual) with a signed check
- Consent forms, master data and payment KYC ready for P4
- Continuous Claude operations monitor live with audited, allow-listed actions (P3-16); inbound WhatsApp and SMS client messages land in the inbox (P3-33)

- [ ] **P3-01** ⚑ Switch off native and third-party auto-replies before shadow mode  
  _Organisation · Accounts & approvals · effort S · after P0-22 · needs Q5, Q8_  
  Turn off Business Suite instant replies, away messages and FAQ automations, TikTok welcome messages and any ManyChat-style tools so leads never get two automated replies and the shadow comparison stays clean. Fewer people stay logged into the brand accounts.  
  **Done when:** Screenshots show every automation off and a test DM gets exactly one reply.
- [ ] **P3-02** Add per-branch scopes and per-person permission overrides  
  _Builder · Core platform · effort M · after P2-08, P2-10 · needs Q4_  
  Scopes (none, assigned, own team, today's, own clients, masked, read-only, full) per branch and per-person grant/deny ticks on top of role templates, all through can() with step-up and audit.  
  **Done when:** A role x permission x scope test passes and a per-person deny takes effect on the next request.
- [ ] **P3-03** Add the audit hash chain, daily R2 copy and audit viewer  
  _Builder · Core platform · effort M · after P2-10_  
  A per-org hash chain over audit rows, a daily copy to R2, optional manager approval for chosen overrides, and a viewer filtered by entity and actor.  
  **Done when:** Editing a row in a test breaks chain verification, the daily copy exists, and the owner filters the viewer by actor.
- [ ] **P3-04** ⚑ Add notification fallback order, bundling and on-call quiet-hours bypass  
  _Builder · Core platform · effort M · after P2-17, P2-69, P2-16 · needs Q4_  
  Push, then WhatsApp or SMS on failure in the configured order with retries and backoff, bundling of low-priority alerts, and quiet hours that urgent events bypass only for the on-call person.  
  **Done when:** Tests show quiet-hours suppression, on-call bypass and push-to-SMS fallback, and a staging drill delivers via fallback when push is disabled.
- [ ] **P3-05** ⚑ Build operational dashboards and alerts for the AI channels  
  _Builder · Channels & AI replies · effort M · after P2-33, P2-75_  
  Per reply: webhook-to-send latency, tokens, cache hits, cost per reply and per day, handoff rate by reason, guardrail blocks, refusals, window misses, DLQ depth and token health, each with an alert threshold. AI-vs-human conversion comes later in P5-03.  
  **Done when:** The team-app dashboard shows every metric for staging traffic and each alert fires in a test.
- [ ] **P3-06** ⚑ Add automatic kill-switch trips  
  _Builder · Channels & AI replies · effort S · after P2-30, P3-05_  
  Trip the per-workspace or per-channel switch automatically on spikes in guardrail blocks, errors, refusals or cost, hold queued drafts, and notify the owner and builder. The switch is also reachable from the app and an emergency env flag.  
  **Done when:** A simulated guardrail spike trips the switch and alerts, while staff sends continue.
- [ ] **P3-07** ⚑ Build scheduled Claude jobs infrastructure and the 08:00 daily brief  
  _Builder · Core platform · effort M · after P2-17, P2-05, P2-75, P0-39_  
  Cron Triggers in UTC fan out per org at local time, with a job registry and run table (status, duration, tokens, cost, prompt version), idempotency per org and date, retries with a DLQ, a per-org jobs kill switch and a Batch API submit/poll/collect helper. The first consumer is the 08:00 brief by email and push.  
  **Done when:** The staging org receives the 08:00 brief on 3 consecutive days with token cost logged, and a forced failure retries then alerts.
- [ ] **P3-08** ⚑ Build the nightly QA job for AI conversations  
  _Builder · Channels & AI replies · effort M · after P3-07, P2-56, P1-33_  
  Each night grade a sample (about 50 per workspace, more for new intents and languages) of the day's AI drafts and sends via the Batch API against the rubric and guardrail checks. Violations go to the owner and privacy lead, and metrics feed the daily brief, weekly review and autopilot gate.  
  **Done when:** It runs 7 nights in a row on co-pilot traffic with cost logged and catches 100% of seeded violations in a staging test.
- [ ] **P3-09** ⚑ Pass the shadow-mode compliance gate and go live in shadow on production (about week 7)  
  _Both · Channels & AI replies · effort S · after P2-55, P1-42, P1-41, P2-62, P1-34, P2-30, P2-35, P2-38, P2-39, P2-37, P2-40, P2-21, P2-47, P2-58, P2-56, P2-57, P2-67, P0-17, P3-01, P2-72, P2-75 · needs Q9_  
  Gate before any live DM reaches Claude: Anthropic DPA, signed DPIA and prior-consultation decision, privacy notice v1 and point-of-collection text, residency settings, retention and erase jobs, staff policies signed, Playbook v0 (or v1) passing the eval gate, disclosure in config, auto-replies off and the manual kill switch tested. Then switch the production app to Live, subscribe the account, backfill open chats via the Conversations API (only the 20 most recent messages; Requests chats inactive 30 days are skipped) and turn on drafting with every AI send blocked.  
  **Done when:** The gate checklist is signed with evidence links, the first real DM produces a stored draft, and the audit log shows zero AI-originated sends in the first 48 hours.
- [ ] **P3-10** Close the DM history gap between the first export and live capture with a top-up export  
  _Both · History & playbook · effort S · after P3-09, P0-42, P1-07, P1-08, P1-09, P2-61 · needs Q8_  
  The first exports end around weeks 2-3 and live capture starts at shadow go-live (about week 7). The Conversations API backfill returns only the 20 latest messages of open chats, so conversations from the weeks in between are in neither history nor the live system. Once shadow is live, request a fresh all-time export per account via the P0-42 runbook and run it through the same parser, masker and de-duplication (P1-08 already handles re-exports). Add the new episodes and outcomes to history and the next extraction run, and seed matched clients as in P2-61.  
  **Done when:** For each account the coverage report shows continuous coverage from the earliest export date to the live start, gap-period episodes are in history with no duplicates, and a gap-period client is recognised when they DM.
- [ ] **P3-11** ⚑ Rate shadow drafts and sign the shadow-to-co-pilot gate  
  _Organisation · Channels & AI replies · effort S · after P3-09, P2-57 · needs Q9_  
  Named reviewers rate a daily sample for 1-2 weeks until the signed criteria (P2-57) are met for each intent and language.  
  **Done when:** A signed gate decision with a metrics snapshot is stored in the audit log.
- [ ] **P3-12** ⚑ Write the coordinator SOP and call script  
  _Both · Launch & operations · effort M · after P2-46, P2-42, P0-31, P2-70, P2-29 · needs Q4, Q5, Q6_  
  Acknowledge alerts within SLA, introduce yourself by name, give the recording notice if applicable, confirm 18+, agree date and payment timing (existing calendar until P4), send payment links (never card details in DMs), log one-tap outcomes, follow no-answer x3 using WhatsApp only with recorded opt-in, and record lost reasons. Also cover do-not-contact and erase, clinical questions to clinicians, complaints to managers, HUMAN_AGENT replies typed by humans within 7 days, override reasons, and replying only from the team app once co-pilot starts.  
  **Done when:** The owner signs the SOP, it is published in the app's help section, and two coordinators complete a role-play following it.
- [ ] **P3-13** ⚑ Write the admin guide and one-page role quick-starts  
  _Builder · Launch & operations · effort M · after P2-73, P2-50 · needs Q4_  
  Cover inviting and offboarding, roles and per-person permissions, 2FA recovery, AI mode and kill switch, playbook approval (interim document until P4-27), rota and ladder edits, export and erase requests, the audit log and MCP grants. Quick-starts for owner, manager, coordinator, clinician, front desk and finance.  
  **Done when:** The owner completes offboarding and the kill switch on staging unaided, and each quick-start is published in the app.
- [ ] **P3-14** ⚑ Set up on-call rotas, service SLAs and a staff support channel  
  _Both · Launch & operations · effort S · after P2-16, P2-75 · needs Q4_  
  Business on-call (coordinators and managers in the app rota) and technical on-call (builder and user), each with backups; SLAs for uptime, incident response, the lead call ladder and defect fixes. Add an in-app 'report a problem' form (no automatic screenshots), a triage board, a named org contact for change requests, and release notes after each deploy.  
  **Done when:** The rota covers all opening hours for the first 4 weeks, a test page reaches primary and backup tech on-call, the owner signs the SLA sheet, and a test report reaches the triage board.
- [ ] **P3-15** ⚑ Write launch runbooks and architecture docs and confirm the organisation's ownership  
  _Both · Launch & operations · effort M · after P2-75, P2-27, P2-30, P2-74, P2-71 · needs Q8_  
  docs/architecture.md, an ADR index and runbooks for deploy and rollback, restore, secret rotation, incidents, Instagram outage or webhook failure (answer in the native app, then backfill), token expiry, losing App Review approval, Claude errors and refusals, queue backlog and DLQ replay, provider failover, the kill switch, offboarding or lost devices, account compromise or platform ban, and adding an organisation. Confirm the organisation holds owner rights and a break-glass login; access reduction waits for P5-23.  
  **Done when:** Each runbook lists trigger, steps, owner and verification, a tabletop of token expiry and a Claude outage has been run, and the owner confirms ownership and break-glass access in writing.
- [ ] **P3-16** Run a continuous Claude operations monitor with bounded, audited actions  
  _Builder · Launch & operations · effort M · after P3-07, P3-05, P3-06, P2-75, P2-10, P3-15_  
  Claude's scheduled jobs run daily, nightly and weekly, and alerts in between reach only humans, so Claude does not monitor 'at all times'. Every 15 minutes, and immediately on any P2-75 alert, a job on the P3-07 infrastructure checks health signals only (webhook and send failures, token health, queue and DLQ depth, unacknowledged SLA timers, notification failures, cron results, guardrail and refusal spikes, spend against budget, kill-switch state; no message bodies). It calls Claude only when a signal leaves its band. Claude writes a triage note linked to the runbook and either pages the right on-call person or takes an allow-listed action (re-alert the next rung, trip the kill switch via P3-06, pause a failing job, open an incident). Anything else goes to a human, and every action is audited as 'claude-ops'. Also connect the official Cloudflare connector read-only for observability in the owner's and builder's Claude sessions, within the P0-19 data-access rule.  
  **Done when:** In staging, injected faults (DLQ backlog, revoked Instagram token, lead unacknowledged past 15 minutes, spend spike, failed cron) each get a Claude triage note and the right page or action within 20 minutes, every action is in the audit log as claude-ops, and an action outside the allow-list is refused.
- [ ] **P3-17** ⚑ Run the pre-go-live security review on staging  
  _Both · Core platform · effort M · after P2-76, P2-50, P2-67, P2-13_  
  Work through OWASP ASVS L2: brute force, session fixation, magic-link reuse, IDOR across tenants and roles, masking bypass via search, export, MCP and notifications, CSRF, XSS and CSP, upload abuse, webhook signature spoofing, secrets in logs or git history, and backup restore. Fix every high and critical finding; the organisation decides on an external pen test.  
  **Done when:** docs/security/review-<date>.md marks every item pass or fixed with no open high or critical findings, the owner signs it, and the pen-test decision is recorded.
- [ ] **P3-18** Set performance budgets in CI and load-test before co-pilot  
  _Builder · Core platform · effort M · after P2-49, P2-48, P2-18 · needs Q4_  
  Initial JS at most 200 KB gzipped, inbox interactive under 2.5 s on a mid-range Android over 4G, API p95 under 300 ms and live updates under 1 s, enforced by size-limit and Lighthouse CI. Load-test 10x the expected daily peak through queue to inbox with 20 concurrent staff sockets and check hot query plans.  
  **Done when:** CI fails a PR that breaks a budget and the load-test report shows every budget met with no dropped or duplicated messages.
- [ ] **P3-19** Build CSV import/export and dry-run organisation 1's client and lead migration  
  _Both · Core platform · effort M · after P2-41, P2-12, P2-10, P0-46 · needs Q5_  
  Upload to private R2, map columns, normalise phones to E.164, dedupe against identities (including history-seeded clients), set marketing consent to unknown unless evidenced, mark clinical notes restricted, report rows in/imported/merged/rejected, and roll back by import id. Exports are masked per role, need step-up, are audited and expire.  
  **Done when:** The dry run re-runs from one command, counts reconcile, the organisation signs a 50-record spot check, and a 1,000-row export follows the user's masking.
- [ ] **P3-20** Capture bookings and attendance from the existing calendar until the P4 cutover  
  _Both · Clinic operations · effort S · after P2-42, P3-19 · needs Q5_  
  Coordinators log booked date, procedure category and deposit status as the call outcome, and front desk marks attended or no-show daily (quick list or CSV import), so conversion metrics use real outcomes.  
  **Done when:** For two weeks after go-live at least 95% of contact-captured leads have a call outcome and every booked lead has attended or no-show recorded.
- [ ] **P3-21** Configure nurture, lost and reopen behaviour within platform windows  
  _Both · Core platform · effort S · after P2-46, P2-29, P2-43_  
  Nurture never means Instagram or TikTok outreach outside the window; follow-ups use consented WhatsApp, SMS or email templates or wait for the person to message. A new message reopens the lead (new episode only if the last is closed), leads auto-close to lost after N days with a reason, and consultations get a 'thinking it over' task.  
  **Done when:** Rules are signed off and tests show no DM sent to a nurture lead outside the window while a new DM reopens the lead.
- [ ] **P3-22** Build the complaint workflow  
  _Both · Clinic operations · effort S · after P2-39, P2-10, P2-43 · needs Q1_  
  A complaint flag (detector, staff or call) assigns a manager with an acknowledgement SLA, pauses AI, suppresses review and marketing requests, and logs resolution, refunds and any regulator referral, using the organisation's complaints policy and wording.  
  **Done when:** A test complaint creates a manager task, pauses AI, blocks review requests and records a resolution, and the owner approves the policy text.
- [ ] **P3-23** ⚑ Add cost controls: budgets, caps and filters that skip the model  
  _Builder · Channels & AI replies · effort S · after P2-33, P3-05 · needs Q4_  
  Daily and monthly budgets per workspace with a warning at 80% and a hard cap that drops to drafts-only, a per-conversation daily cap on AI turns, and a pre-filter so reactions, 'ok/thanks' and spam never call Claude. Check the cache-hit ratio weekly.  
  **Done when:** A tiny staging budget triggers the warning then the fallback, and reaction-only messages make no Claude call.
- [ ] **P3-24** ⚑ Run go-live training on the app, privacy, consent, escalation and AI limits  
  _Both · Launch & operations · effort M · after P3-12, P3-13, P2-72, P2-71, P2-64 · needs Q4_  
  Hands-on 60-90 minute sessions per role in staging with synthetic leads, recorded for new starters, covering co-pilot, take-over, kill switch, handoffs, consent and do-not-contact, minors, clinical escalation, what the AI may say, the 24 h and HUMAN_AGENT rules, DSAR intake and incident reporting. Each coordinator must handle a scripted lead end to end.  
  **Done when:** The attendance log shows every go-live user trained, every coordinator passed, and recordings are in the help section.
- [ ] **P3-25** ⚑ Run co-pilot UAT with real staff on staging  
  _Both · Launch & operations · effort M · after P3-24, P2-50, P2-19, P3-04, P2-45, P2-51 · needs Q4, Q7, Q9_  
  Scripts: DM to draft to send; number detection to alert to 15/60-minute escalation; clinical, complaint and minor handoffs; disclosure; 24 h and HUMAN_AGENT rules; kill switch; manual-assist capture; each DM language; override with reason; lost-device revoke. Every staff phone installs the PWA with push verified, and each defect gets a severity and owner.  
  **Done when:** Named staff pass every script, no severity-1/2 defects are open, push works on every staff phone, and the owner signs the UAT report.
- [ ] **P3-26** ⚑ Run the Instagram co-pilot go/no-go and switch on co-pilot (about week 9)  
  _Both · Launch & operations · effort S · after P3-11, P3-25, P3-15, P3-14, P3-17, P2-74, P2-67 · needs Q8, Q9_  
  Check with evidence: shadow gate signed, UAT and training signed, disclosure, escalation and minors wording live, legal guardrail tests passing, window and HUMAN_AGENT tests, kill switch, escalation on real phones, rota filled, runbooks, security review, backups verified, DSAR jobs, and the reply-from-the-app rule in force. Rollback is the kill switch back to the manual inbox.  
  **Done when:** Every item is ticked with evidence, the owner records 'go', and staff send a co-pilot draft in reply to the first real DM.
- [ ] **P3-27** ⚑ Run two weeks of hypercare after co-pilot go-live  
  _Both · Launch & operations · effort M · after P3-26 · needs Q9_  
  Daily 15-minute stand-up with coordinators; the builder reviews errors, queues, SLA breaches and a sample of drafts daily and triages defects against severity SLAs. Exit when no severity-1/2 issues are open, SLAs are met 5 days running and staff work unaided.  
  **Done when:** Exit criteria are met and the owner signs a hypercare report covering incidents, fixes and open items.
- [ ] **P3-28** ⚑ Analyse co-pilot edits and ship the next playbook version before autopilot  
  _Both · History & playbook · effort M · after P3-26, P2-56_  
  Compare drafts with what staff sent; Claude classifies each edit (price fix, tone, wrong question, guardrail, fact), and patterns seen at least 5 times become proposals that pass lint, the eval gate and owner approval (plus clinician sign-off if clinical).  
  **Done when:** An edit-analysis report exists and a new version is approved, or 'no changes' is recorded, before the autopilot gate.
- [ ] **P3-29** Contract the TikTok messaging partner if the fallback is triggered  
  _Both · Accounts & approvals · effort S · after P0-29 · needs Q1, Q8_  
  Only for an eligible account whose direct application was refused or delayed: open respond.io or SleekFlow in the owner's name, sign its DPA, connect the TikTok Business Account and give the builder a scoped API key.  
  **Done when:** A test TikTok DM appears in the partner inbox and the key is stored as a Workers secret, or the task is closed as not triggered.
- [ ] **P3-30** Integrate the TikTok Business Messaging API: webhooks, signature check, OAuth and token refresh  
  _Builder · Channels & AI replies · effort M · after P0-28, P0-29, P2-25, P2-20 · needs Q1, Q8_  
  Only if access is granted: implement the webhook with TikTok's current signature scheme, OAuth for the Business Account with scheduled refresh and expiry alerts, and mapping into the shared message schema.  
  **Done when:** A DM to the test TikTok account appears as a normalised message in staging, a tampered signature is rejected and refresh runs unattended.
- [ ] **P3-31** Implement TikTok sending within 48 h and the 10-message cap  
  _Builder · Channels & AI replies · effort M · after P3-30, P2-30_  
  A send client with media, typed errors and backoff wired to the send gate's 48 h and per-user-message counters; TikTok then goes through shadow, co-pilot and autopilot like Instagram.  
  **Done when:** Boundary tests for 48 h and the 11th message pass and a co-pilot reply reaches the test TikTok account.
- [ ] **P3-32** Build the partner fallback adapter (respond.io or SleekFlow)  
  _Builder · Channels & AI replies · effort M · after P3-29, P2-25, P2-30_  
  Inbound partner webhooks (verify signing) go through the normaliser, dedupe and engine; outbound goes through the partner API with its window rules mirrored in the send gate. A per-workspace flag makes a later switch to the direct API a config change.  
  **Done when:** A TikTok DM arrives via the partner, staff send the draft from our inbox and it is delivered, and duplicate deliveries create one message.
- [ ] **P3-33** Handle inbound WhatsApp and SMS client conversations in the inbox and reply engine  
  _Builder · Channels & AI replies · effort M · after P2-69, P2-25, P2-30, P2-46, P2-49, P2-50, P1-28 · needs Q5, Q7_  
  TikTok manual mode invites leads to WhatsApp and P4 reminders ask clients to confirm, but P2-69 handles only staff alerts, delivery status and STOP, so client messages on the Cloud API number have nowhere to land. Normalise inbound WhatsApp and SMS messages into the shared schema and link them to the client by E.164; a first WhatsApp message from an unknown number becomes a contact-captured lead. Show them in the unified inbox with a channel badge. Let the reply engine draft through the same shadow and co-pilot stages within WhatsApp's 24 h customer-service window as a business-specific assistant (bookings, FAQs and support only), using templates outside the window and the approved WhatsApp and SMS disclosure strings.  
  **Done when:** A WhatsApp message and an SMS reply from a test client appear on the client's record in the inbox within 5 s, an unknown WhatsApp number creates a lead with a call task, a co-pilot draft carries the disclosure, and a free-form send after 24 h is blocked.
- [ ] **P3-34** Enable TikTok manual mode for region-blocked or no-API accounts  
  _Builder · Channels & AI replies · effort S · after P2-51, P0-29, P3-33 · needs Q1, Q8_  
  Using the composer's paste capture, staff paste a TikTok DM with handle and time, the AI drafts with disclosure and an approved invitation to continue on Instagram or WhatsApp, and staff send natively and tap 'Mark as sent'; the 48 h countdown runs from the pasted time.  
  **Done when:** A coordinator handles a TikTok DM end to end on a phone in under a minute, it appears in pipeline and analytics tagged 'manual', and a pasted DM containing a phone number fires contact.captured with the coordinator alert and SLA clock exactly as an API message would.
- [ ] **P3-35** Run the TikTok go-live check for the chosen route  
  _Both · Launch & operations · effort S · after P0-29, P3-26, P1-28 · needs Q1, Q8_  
  After the route's build task (P3-31, P3-32 or P3-34): for API or partner routes prove the 48 h and 10-message limits, disclosure strings and any partner DPA; for manual mode check intake works, drafts carry the disclosure, nothing is sent automatically and the invitation wording is approved.  
  **Done when:** A signed TikTok checklist with test evidence is filed and TikTok enters shadow or manual co-pilot.
- [ ] **P3-36** Transcribe voice notes for the reply engine  
  _Builder · Channels & AI replies · effort M · after P2-31 · needs Q7_  
  Evaluate Workers AI Whisper against alternatives for the DM languages and DPA coverage, store transcript, language and confidence, mark transcribed text in the prompt, and hand off on low confidence.  
  **Done when:** Staff rate at least 90% of 30 voice notes as usable transcripts and low-confidence notes create a handoff.
- [ ] **P3-37** Handle comment-to-DM private replies and story mentions (only if the comments permission was granted)  
  _Both · Channels & AI replies · effort M · after P2-55, P2-30, P2-25_  
  The organisation decides which comment intents get one private DM and whether story mentions get a thank-you; the AI posts no public replies, and each private reply carries the disclosure (verify Meta's time and one-reply limits). Record the source post, story or ad on the lead; if the permission was not requested, schedule a second review in P5.  
  **Done when:** Commenting 'price?' on a test post produces exactly one private DM within 60 s with the post as lead source, and a repeat comment produces none.
- [ ] **P3-38** ⚑ Add language detection, same-language replies and staff translation  
  _Builder · Channels & AI replies · effort M · after P2-50, P2-34 · needs Q7_  
  Reply in the user's language when it is approved, hand off otherwise, and give staff an on-demand cached translation of messages and drafts while keeping the original text.  
  **Done when:** Eval cases in each approved language get replies in that language, an unapproved language hands off, and the translation toggle works on staging.
- [ ] **P3-39** ⚑ Run the autopilot go/no-go gate  
  _Both · Launch & operations · effort S · after P3-27, P3-08, P3-06, P2-63, P2-57, P3-05, P3-28, P3-38 · needs Q9_  
  Against the signed criteria over at least 2 weeks of co-pilot: per-intent unedited-send rates, zero guardrail breaches, SLAs met, nightly QA below thresholds, a clinician review of 100 AI conversations, the red-team suite at 100%, a kill-switch drill and out-of-window sends blocked. Autopilot is limited to the non-clinical intents named in the safeguards record.  
  **Done when:** A signed gate record holds the metric evidence for each criterion.
- [ ] **P3-40** ⚑ Switch on Instagram autopilot in stages (realistically weeks 11-13)  
  _Both · Channels & AI replies · effort S · after P3-39, P3-23 · needs Q9_  
  Auto-send only when confidence meets the per-intent threshold, no risk flag is set, guardrails pass, the window is open, no human holds the chat and caps are not reached; otherwise fall back to co-pilot. Roll out intent by intent and by percentage of conversations, with the owner signing each step.  
  **Done when:** Autopilot is on for the first intent set with signed approval, and a week of data shows handoff, guardrail and cost rates within the agreed bounds.
- [ ] **P3-41** Add saved replies to the composer  
  _Builder · Core platform · effort S · after P2-50, P1-31, P2-34, P2-14, P2-10 · needs Q7_  
  The feature map lists saved replies under the unified inbox, but no task builds them. Add a per-workspace, per-language library of approved snippets with variables (first name, branch address, public number, price item IDs). Snippets are managed under a 'manage saved replies' permission, linted against the banned-phrase, claims and price rules before saving, and insertable into the composer's edit box. Every change is audited.  
  **Done when:** A snippet that breaks a lint rule cannot be saved, a passing snippet is inserted and sent from the composer in two languages with prices resolved from the price store, and every change appears in the audit log.
- [ ] **P3-42** Configure business-hours behaviour for AI replies and handoff promises  
  _Both · Channels & AI replies · effort S · after P2-16, P2-35_  
  Timezone, opening hours, holidays and call-back promises as config; handoff wording adapts via per-turn context (e.g. 'a coordinator will call tomorrow after 9:00') while the AI still replies 24/7 within windows.  
  **Done when:** Out-of-hours eval cases produce correct next-opening wording and an hours change takes effect without a redeploy.
- [ ] **P3-43** Complete the clinic master data workbook  
  _Organisation · Clinic operations · effort M · after P0-32 · needs Q2_  
  Locations (address, hours, closures, timezone, directions, parking, prep notes), practitioners (role, registration, permitted procedures, working pattern), rooms and equipment, and per procedure the duration, buffer, room, sessions per course, minimum interval, consent forms, aftercare protocol and packages; prices reference the price list.  
  **Done when:** The workbook has no blank required cells, the owner and lead clinician sign it, and it imports into staging without errors.
- [ ] **P3-44** Approve versioned consent forms, aftercare protocols and photo consent for every procedure  
  _Both · Clinic operations · effort M · after P3-43, P1-43, P1-40 · needs Q1, Q2_  
  The lead clinician supplies risk consent, clinical-record photo consent and a separate optional marketing consent, plus aftercare protocols with check-in days and red-flag symptoms. The legal reviewer confirms e-signature validity, cooling-off and any in-person consent requirement per procedure and jurisdiction (verify).  
  **Done when:** Every procedure maps to at least one signed consent form and aftercare protocol, with the e-signature verdict recorded.
- [ ] **P3-45** Choose the payment provider, set money policies and complete KYC  
  _Both · Clinic operations · effort M · after P0-14, P2-04, P0-15 · needs Q1, Q2, Q5, Q6_  
  Decide deposits, cancellation and no-show fees, refunds and instalments; the legal reviewer confirms distance-contract cancellation rights (e.g. 14 days unless the client asks to start sooner; verify) and whether instalments trigger consumer-credit rules. Pick a provider whose restricted-business list accepts the procedure type, complete KYC by the end of P3 and invite the builder without payout access.  
  **Done when:** The owner signs the policy sheet and the merchant account is activated for live payments in the organisation's name.
- [ ] **P3-46** Enrol in the Apple Developer Program and Google Play Console and set up Firebase and APNs  
  _Organisation · Apps, analytics & retention · effort S · after P0-34, P0-09 · needs Q1_  
  Enrol as an organisation in Apple's program ($99/yr) and open a Play Console organisation account (verify identity checks), with the owner as account holder and the builder at a limited role. Create an org-owned Firebase project for FCM and an APNs .p8 key stored in the vault, with renewal dates in the register.  
  **Done when:** Both accounts are active in the legal name, the builder has non-owner roles, and the APNs key and FCM project exist.

## P4 · Clinic operations (9-14)

Exit criteria:

- Booking engine live with a non-overridable under-18 block and ID check at consultation
- Treatment plans, sessions, e-signed consent and restricted photo storage in use
- Deposits, instalments, refunds and reconciliation running on live keys
- Reminders sent via approved WhatsApp templates or SMS with consent
- Clinic UAT signed, privacy notice v2 live and cutover complete
- MCP server available to approved users

- [ ] **P4-01** Add D1 migrations for clinic operations  
  _Builder · Clinic operations · effort M · after P2-02, P2-03, P0-17 · needs Q2, Q5, Q6_  
  Locations, practitioners, rooms, availability and appointments (with no-show and reschedule chain); treatment plans, plan procedures and sessions; packages, quotes, payments, instalments, invoices and refunds; consent templates and signed forms, photos (clinical class), aftercare schedules and external ids, stored per the hosting ADR.  
  **Done when:** Migrations apply on staging, RBAC, masking and cross-tenant tests extended to the new tables pass, and docs/data-model.md is updated.
- [ ] **P4-02** Build locations, practitioners, rooms and the availability engine  
  _Builder · Clinic operations · effort M · after P4-01, P3-43, P2-08 · needs Q2, Q5_  
  Working patterns, breaks, closures and holidays; free slots per procedure from duration plus buffer, room and practitioner qualification; staff slot views in the PWA.  
  **Done when:** Seeded data returns correct slots for 20 scripted cases including a DST change, a closure and a room conflict.
- [ ] **P4-03** Build the booking engine with slot holds and a non-overridable under-18 block  
  _Builder · Clinic operations · effort M · after P4-02, P2-10 · needs Q5_  
  Writes serialise per location in a Durable Object so nothing is double-booked, coordinators can hold a slot during the call, and date of birth is required. The under-18 block cannot be overridden; the only path is correcting the date of birth with the ID check recorded, and every attempt is audited.  
  **Done when:** 50 parallel requests for one slot produce one booking, under-18 bookings are refused by UI and API for every role, and attempts appear in the audit log.
- [ ] **P4-04** Enable the get_availability tool for the reply engine  
  _Builder · Channels & AI replies · effort S · after P4-02, P2-36_  
  A read-only tool giving coarse availability so the AI can suggest times; the coordinator still confirms on the call, and the change passes the eval gate.  
  **Done when:** Eval cases using availability pass with no booking language under risk flags.
- [ ] **P4-05** Integrate practitioner calendars or the existing clinic software  
  _Builder · Clinic operations · effort M · after P4-03 · needs Q5_  
  If the clinic software stays the source of truth, integrate via its API or document a double-entry rule; otherwise sync Google or Microsoft 365 calendars over OAuth, importing busy times and exporting appointments with non-clinical titles, with subscription renewal (verify whether Google app verification is needed).  
  **Done when:** A booking appears in the practitioner's calendar within 2 minutes with a non-clinical title, an external busy event blocks the slot, and renewal has run in staging.
- [ ] **P4-06** Build consultation check-in: arrival, ID age check and pre-consultation questionnaire  
  _Both · Clinic operations · effort M · after P4-03, P2-12, P1-27 · needs Q1, Q2_  
  Front desk marks arrival and records that photo ID was checked (type only, no image), which clears the client or triggers the under-18 exit; the client completes a clinician-approved medical-history questionnaire stored in restricted clinical fields.  
  **Done when:** A consultation cannot start until the age check is recorded, only clinical roles see the questionnaire, and the lead clinician approves it.
- [ ] **P4-07** Build the episode, treatment plan, procedure and session model  
  _Builder · Clinic operations · effort M · after P4-01, P3-43, P2-10 · needs Q2_  
  Plans hold several procedures, each with its own session count, interval, price, package and payment plan; states quoted, accepted (full or partial), in progress, paused, complete, aftercare and closed, plus declined, not suitable and cancelled with reasons and logged overrides. A procedure can be added to or removed from a plan already in progress as a new plan version with its own quote acceptance and consent, leaving completed sessions and payments untouched. Returning clients get a new episode with earlier ones read-only and re-consent flagged.  
  **Done when:** Tests cover every allowed and forbidden transition, a 2-procedure x 6-session plan schedules correctly, adding a third procedure after session 3 creates a new plan version needing its own acceptance while sessions 1-3 stay unchanged, and a returning client's new episode leaves the old one unchanged.
- [ ] **P4-08** Build the treatment plan builder, quote PDF and session log  
  _Builder · Clinic operations · effort M · after P4-07, P2-14, P2-12 · needs Q2, Q6_  
  Clinicians build plans from the catalogue with role-limited discounts, a versioned quote PDF is stored in R2 and accepted in full or part by secure link, and the session log records attendance, practitioner, restricted notes and product or batch numbers where needed, proposing the next date.  
  **Done when:** A clinician builds a 2-procedure plan, the client accepts one procedure by link, the quote matches the price list, and notes are hidden from front desk.
- [ ] **P4-09** Implement consent forms with e-signature and a session-start block  
  _Builder · Clinic operations · effort M · after P3-44, P4-07 · needs Q1, Q2_  
  Render versioned templates, sign on a clinic tablet or by link with phone OTP, and store signer, timestamp, device, version and a SHA-256 of the signed PDF in restricted R2. A session cannot start while consent is missing, outdated or withdrawn.  
  **Done when:** Signed PDFs verify against their hashes, a session without consent is blocked in UI and API, and the legal reviewer has checked a sample record.
- [ ] **P4-10** Set the clinical photo-capture method and enrol clinic-owned devices  
  _Both · Clinic operations · effort S · after P2-72 · needs Q4_  
  Until native capture in P5, photos are taken only on clinic-owned tablets or phones through the app's upload, never on personal phones or into the camera roll. The organisation buys and enrols the devices (screen lock, remote wipe), and the same tablets serve consent signing.  
  **Done when:** The owner signs the procedure and a spot check finds every clinical photo came from an enrolled device with none in device galleries.
- [ ] **P4-11** Store before/after photos in restricted storage with per-view audit  
  _Builder · Clinic operations · effort M · after P3-44, P2-10, P2-67, P4-10 · needs Q1, Q2_  
  A separate private bucket served only through a permission-checking Worker with short-lived URLs, EXIF/GPS stripped, every view logged, and marketing use behind its own consent flag, hosted per the HIPAA decision.  
  **Done when:** No public or guessable URL works, a coordinator is refused, every view is audited, and uploads contain no GPS data.
- [ ] **P4-12** Sign payment and clinic-software processor terms and approve payment-handling rules  
  _Both · Legal & compliance · effort S · after P3-45 · needs Q5, Q6_  
  Accept DPAs for the payment provider and any integrated clinic or calendar software, confirm card data never enters the system (hosted pages only), and approve the deposit, refund and cancellation text shown before payment.  
  **Done when:** DPAs are on file and the payment-handling rules and terms text are approved and in the templates.
- [ ] **P4-13** Integrate payment links for deposits and balances with an internal ledger  
  _Builder · Clinic operations · effort M · after P3-45, P4-07, P4-03, P4-12 · needs Q1, Q6_  
  Hosted links sent by SMS, WhatsApp or email after the call; restricted keys per environment; signature-verified, idempotent webhooks posting to a ledger in minor units per plan and client. Run end to end in test mode before live keys.  
  **Done when:** In test mode a paid deposit link marks the booking paid within 1 minute, a replayed webhook creates no duplicate entry, and a forged one is rejected.
- [ ] **P4-14** Build instalments, balances, invoices and refunds  
  _Builder · Clinic operations · effort M · after P4-13 · needs Q1, Q6_  
  Instalment schedules on the provider's scheduled-charge features (verify SCA for EEA/UK), balances per client and plan, numbered invoices with the accountant's tax treatment, and refunds needing Owner or Manager approval with a reason.  
  **Done when:** A 3-instalment test plan with one failed charge and one partial refund ends with a zero-difference balance, and a coordinator cannot issue a refund.
- [ ] **P4-15** Automate daily payment reconciliation and the accounting export  
  _Builder · Clinic operations · effort S · after P4-14 · needs Q5, Q6_  
  A nightly job matches provider charges, refunds, fees and payouts to the ledger and sends finance the mismatches; month end produces a CSV or sync for the accounting tool.  
  **Done when:** A seeded month with 3 injected mismatches reports exactly those 3 and the accountant confirms the export format.
- [ ] **P4-16** Create, submit and track WhatsApp client templates  
  _Both · Clinic operations · effort M · after P2-69 · needs Q6, Q7_  
  The organisation approves wording per language for appointment reminder, confirmation, reschedule, no-answer follow-up, aftercare check-in, next session due and payment reminder; the builder submits with the correct category (verify utility vs marketing), versions them and alerts on rejection, pause or quality drops.  
  **Done when:** Every template shows Approved in each language and is referenced by name and version in the reminder config.
- [ ] **P4-17** Automate booking confirmations, reminders and deposit-due escalation  
  _Builder · Clinic operations · effort M · after P4-03, P4-16, P4-13, P3-04, P3-33 · needs Q1, Q5, Q7_  
  Confirmation with directions and prep notes on booking; a day-before reminder by WhatsApp template or SMS per consent and a push to the practitioner; unconfirmed by 18:00 creates a call task; deposit unpaid 24 h before alerts coordinator and finance. Respect quiet hours, windows and per-country sender rules.  
  **Done when:** A scripted staging booking triggers each message on time in the client's language and every send is logged with template ID and consent basis.
- [ ] **P4-18** Build no-show, reschedule and waitlist flows  
  _Builder · Clinic operations · effort M · after P4-03, P4-17, P3-45 · needs Q6_  
  Marking a no-show applies the fee policy, creates a rebook task and flags repeats; reschedules keep their history; a cancelled slot is offered to matching waitlisted clients and the first to accept wins via the booking Durable Object.  
  **Done when:** Scripted tests pass for no-show to rebook, three reschedules, and a slot offered to two waitlisted clients where only the first gets it.
- [ ] **P4-19** Automate next-session-due nudges for treatment courses  
  _Builder · Clinic operations · effort M · after P4-08, P4-16, P4-17, P2-29, P3-04 · needs Q7_  
  §07's 'next session due' alert has a template (P4-16) but no trigger, so courses lasting months rely on staff memory. When a plan's next session reaches its minimum interval with nothing booked, send the approved next-session-due template by consented WhatsApp or SMS, notify the assigned coordinator, and create a call task if it is still unbooked after a configurable number of days. Paused, cancelled or complete plans send nothing, and a 'courses at risk' list shows clients overdue for a session.  
  **Done when:** A seeded 2-procedure x 6-session plan with one session unbooked gets the template on the due date in the client's language with the consent basis logged and a call task after the set days, a paused plan gets nothing, and the at-risk list shows the client.
- [ ] **P4-20** Publish privacy notice v2 covering payments, clinic tools and treatment records  
  _Both · Legal & compliance · effort S · after P1-41, P4-12 · needs Q5, Q6_  
  Add the payment provider, integrated clinic and calendar software, treatment records, consent forms and photos, then re-translate.  
  **Done when:** v2 is live, legal-reviewed and translated before the clinic cutover.
- [ ] **P4-21** Generalise the rules engine and move the handoff and retry cadences onto it  
  _Builder · Core platform · effort L · after P2-46, P2-10_  
  Domain events on a queue with a DLQ feed versioned per-org JSON rules (triggers and conditions on channel, stage, tags, time, language; actions assign, task, notify, move stage, tag, pause AI, start SLA) with loop protection, dry run and a run log. Replace the hard-coded handoff flow without behaviour change.  
  **Done when:** The P2 handoff tests pass unchanged on the engine and replaying an event creates no duplicates.
- [ ] **P4-22** Build the no-code automation rule editor  
  _Builder · Core platform · effort M · after P4-21_  
  A visual if-this-then-that editor with templates, a 7-day dry run, versioning with rollback, enable/disable, a 'manage automations' permission and a reason for every change.  
  **Done when:** An organisation admin creates and enables a rule unaided and the dry run lists the expected matches.
- [ ] **P4-23** Build the pipeline editor and kanban board  
  _Builder · Core platform · effort M · after P2-43, P2-10_  
  Per org, branch or service: stages, allowed transitions and required fields, plus a board with drag-and-drop and a keyboard alternative, counts and SLA badges; the under-18 rule stays non-overridable.  
  **Done when:** An admin adds a stage and transition unaided and a drag move writes stage history and an audit row.
- [ ] **P4-24** Build the duplicate-merge wizard  
  _Builder · Core platform · effort M · after P2-41, P2-10_  
  Detect duplicates by E.164 phone, email or handle and merge field by field with a required reason, an audit entry and undo via the merge log.  
  **Done when:** Merging two seeded duplicates keeps all messages and history on one record and can be undone.
- [ ] **P4-25** Add permission-aware search across clients, conversations and notes  
  _Builder · Core platform · effort M · after P2-03, P2-12, P2-67_  
  FTS5 tables (verify D1 support) kept in sync by triggers, exact lookup by phone in any format, email and handle, tenant and RBAC filtering with role masking, and erased clients removed from the index.  
  **Done when:** On a 50k-message seed a phone typed in any common format finds the client at under 300 ms p95, Marketing sees masked results, and an erased client cannot be found.
- [ ] **P4-26** Generate the AI call brief on handoff  
  _Builder · Channels & AI replies · effort M · after P2-46, P2-33, P2-12_  
  On contact.captured, Claude reads the masked conversation and returns what they want, procedures, timing, price discussed (approved ranges), preferred contact time, language, flags and a suggested opener, never clinical advice; a plain summary is used if it takes over 20 s.  
  **Done when:** The brief appears on the task within 30 s, a coordinator rates at least 18 of 20 samples acceptable, and the eval set shows no clinical advice.
- [ ] **P4-27** Build the playbook editor and approval workflow in the app  
  _Builder · Core platform · effort M · after P1-23, P2-08, P2-10, P2-56_  
  Each rule appears with its evidence and a diff against the active version and is approved or rejected with a reason; clinical rules need clinician sign-off (name, registration, version hash). Lint and eval run before publish, with one-click rollback.  
  **Done when:** A version is reviewed, clinician-signed and published entirely in the app, an unsigned clinical rule cannot be published, and rollback works.
- [ ] **P4-28** Set the access policy for MCP server and Claude app connections  
  _Both · Legal & compliance · effort S · after P1-42, P2-08 · needs Q4_  
  Define who may connect, require commercial Claude plans with DPA coverage (verify plans), limit tools by role, exclude clinical fields by default and log every action under the connecting user; add it to the DPIA and staff policy.  
  **Done when:** The policy is approved with allowed plans and roles listed.
- [ ] **P4-29** Stand up the remote MCP server with OAuth mirroring user permissions (read tools)  
  _Builder · Core platform · effort M · after P4-28, P2-08, P2-12, P2-10, P2-07_  
  workers/mcp uses the Agents SDK's stateless createMcpHandler with the Workers OAuth Provider; authorisation needs login plus step-up, and tokens are per user and org, short-lived and revocable. Read tools: leads awaiting a call, search, client/episode/conversation (masked), pipeline counts, SLA breaches, tasks and metrics, plus system health for permitted roles (channel and token status, queue and DLQ depth, scheduled-job runs, spend against budget, kill-switch and AI-mode state), all rate-limited and audited as 'user via Claude'.  
  **Done when:** A staging user connects it as a custom connector and correctly answers 'Which leads shared a number today and haven't been called?', Marketing sees masked numbers, and a revoked token fails.
- [ ] **P4-30** Add MCP write tools with explicit confirmation  
  _Builder · Core platform · effort M · after P4-29, P2-50, P2-10, P2-38, P4-03, P4-07_  
  Move stage (reason required), create, complete or assign tasks, add notes, pause or resume AI, reschedule an appointment or treatment session through the booking engine (slot holds, the under-18 block and reminders still apply), and draft client messages, all via prepare-then-confirm with a 5-minute token. MCP-originated client messages count as AI-generated: same guardrails and disclosure, never HUMAN_AGENT, only inside windows, logged via=mcp.  
  **Done when:** A 'move her session 3 to Thursday and tell her' request previews the new slot and message and changes or sends nothing until confirmed, then reschedules through the booking engine; a denied tool returns a clear error, and audit rows show via=mcp.
- [ ] **P4-31** Provide commercial Claude seats and add the MCP server as an organisation connector  
  _Organisation · Accounts & approvals · effort S · after P4-29, P4-28 · needs Q1, Q4_  
  Buy Team or Enterprise seats for the owner and managers who will use it (verify plans and DPA coverage), add the server as an org custom connector, and forbid personal consumer accounts. If HIPAA applies, only a HIPAA-ready Enterprise plan can sit under Anthropic's BAA (Team cannot, and Enterprise has a seat minimum), and data a connector sends to third parties is outside it, so get the privacy lead's sign-off or keep clinical fields out of MCP (verify).  
  **Done when:** Each approved user connects through the org connector and their actions appear in the audit log under their own name.
- [ ] **P4-32** Enrol in Apple Business Manager and bind managed Google Play  
  _Organisation · Apps, analytics & retention · effort S · after P3-46 · needs Q1, Q4_  
  Record the ABM Organization ID for private custom-app distribution and the managed Play enterprise ID, and decide distribution (MDM or redemption codes) from staff count and device ownership.  
  **Done when:** Both IDs are in the register and the distribution method is decided in writing.
- [ ] **P4-33** Build the end-to-end client-journey regression suite and per-PR preview deploys  
  _Builder · Core platform · effort M · after P4-09, P4-13, P4-18, P2-18_  
  A synthetic, mocked-platform journey from DM through qualifying, number shared, handoff, booking, consultation, a two-procedure plan, sessions, aftercare and a return episode, plus side exits (under 18, do-not-contact, erase, no-show, complaint), run nightly and before releases. Add per-PR preview deploys bound to seeded data.  
  **Done when:** The suite runs nightly in CI, a failure blocks release, and PRs get a working preview URL.
- [ ] **P4-34** Run a breach-response tabletop exercise  
  _Both · Legal & compliance · effort S · after P2-71_  
  Simulate a leaked R2 export link and an AI message giving medical advice to a minor, walking through detection, kill switch, assessment, the 72-hour decision, notifications and the breach log.  
  **Done when:** An exercise report with timings and fixes is filed and the plan is updated.
- [ ] **P4-35** Write clinic and payment runbooks  
  _Builder · Launch & operations · effort M · after P4-13, P4-05, P4-11 · needs Q1_  
  Payment webhook failure and reconciliation mismatch, calendar sync failure, a double booking, D1 point-in-time restore, suspected exposure of photos or clinical data (with breach deadlines for the jurisdiction), and WhatsApp template rejection or quality drop.  
  **Done when:** Each runbook lists trigger, steps, owner and verification, and a tabletop of the data-exposure runbook has been run with the owner.
- [ ] **P4-36** Run clinic-operations UAT and train front desk, clinicians and finance  
  _Both · Launch & operations · effort M · after P4-09, P4-11, P4-14, P4-17, P4-18, P4-06, P4-08 · needs Q4, Q5, Q6_  
  Scripts for book, move and cancel, waitlist, reminders, consent signing, photo upload and view audit, the check-in age check, a 2-procedure plan, a returning-client episode, and deposit, instalment, refund and reconciliation in test mode; training follows the P3 format with recordings.  
  **Done when:** Named staff pass every script, no severity-1/2 defects are open, and every P4 user is trained.
- [ ] **P4-37** Execute the clinic-operations cutover and final data migration  
  _Both · Launch & operations · effort M · after P4-36, P3-19, P4-20, P4-15, P4-05, P4-35 · needs Q5, Q6_  
  Freeze the old tool, migrate future appointments and active courses, enable calendar sync, switch payments to live keys, confirm templates and consent forms, and announce the date the app becomes the source of truth, followed by one week of hypercare. Rollback reopens the old tool from the freeze snapshot.  
  **Done when:** Reconciliation shows every future appointment in the app, the first live deposit is paid and reconciled, and the owner signs the cutover record.

## P5 · Native apps, analytics, retention and learning loop (13-18)

Exit criteria:

- Native iOS/Android apps installed privately on every rostered staff device
- Analytics dashboards and the monthly report live, with AI-vs-human conversion
- Aftercare check-ins and consented campaigns running
- Weekly extraction, playbook proposals and A/B tests running
- Onboarding package proven on a dummy organisation; builder access reduced to the agreed level
- Native apps pass a per-role route-parity test against the web
- Autopilot extended beyond the first intent set, with the automated-reply share reported against the owner's target (P5-12)

- [ ] **P5-01** Wrap the PWA with Capacitor and add native push and device security  
  _Builder · Apps, analytics & retention · effort M · after P2-19, P3-46, P3-04_  
  iOS and Android projects from the same codebase with APNs and FCM push (payloads carry only an ID), biometric lock, tokens in Keychain/Keystore, an app-switcher privacy screen, FLAG_SECURE on clinical screens, an in-app camera that never saves to the gallery, and deep links.  
  **Done when:** Debug builds on an iPhone and an Android phone receive a lead push within 10 s that deep-links, biometric lock works, clinical screenshots are blocked on Android, and a parity test logged in as each role template reaches every route and action in the native builds that the same role reaches on the web.
- [ ] **P5-02** Set up signed CI builds, private distribution and device management, with runbooks  
  _Both · Apps, analytics & retention · effort M · after P5-01, P4-32 · needs Q1, Q4_  
  A macOS CI runner builds, signs and uploads both apps; iOS goes as a custom app to the ABM Organization ID with reviewer notes and a demo login, Android privately to managed Play. Write runbooks for custom-app rejection and certificate or profile expiry.  
  **Done when:** Both apps install on every rostered device, a release builds from a tagged commit, and a lost-device test removes app data (MDM wipe, or session revoke plus wipe on next launch without MDM).
- [ ] **P5-03** Build the analytics data model and attribution, including AI vs human conversion  
  _Builder · Apps, analytics & retention · effort M · after P4-13, P4-03, P1-20, P2-50 · needs Q3_  
  A metric dictionary and nightly rollups for the funnel (lead, qualified, contact captured, booked, attended, plan accepted, revenue) by channel, post or ad, staff and AI mode (AI-sent, unedited draft, edited, human), plus first-reply time, number-to-call time and SLA breach rate. Verify referral fields in webhooks, otherwise use the AI's 'where did you see us' answer, and define forecast error bands here.  
  **Done when:** The owner approves the dictionary and rollups match manual counts for a sample week within 2%.
- [ ] **P5-04** Build the monthly performance report with compliance metrics and drift alerts  
  _Builder · Apps, analytics & retention · effort M · after P5-03, P3-07, P2-09_  
  Claude summarises rollups only (no transcripts): funnel, speed, AI vs human and revenue by source, plus compliance metrics (DSARs on time, consent withdrawals, do-not-contact breaches, guardrail blocks, under-18 flags, clinical escalations, out-of-window attempts, incidents) with review thresholds. A daily check alerts when reply time, call time or conversion leaves agreed bands.  
  **Done when:** The first report is delivered and reviewed by the owner and privacy lead, and a simulated conversion drop triggers a drift alert.
- [ ] **P5-05** Build analytics dashboards, returning-client cohorts and forecasts  
  _Builder · Apps, analytics & retention · effort M · after P5-03, P2-08_  
  Role-gated dashboards for funnel, speed, AI vs human conversion, revenue per source, cohorts by first-visit month, and a forecast from scheduled sessions, instalments and weighted pipeline, with CSV export.  
  **Done when:** The owner signs off dashboards on live data, roles without analytics get 403, and after two full months of live data the forecast back-test lands within the defined band.
- [ ] **P5-06** Re-check consent and marketing rules before enabling retention campaigns  
  _Both · Legal & compliance · effort S · after P2-28, P2-29 · needs Q1, Q5_  
  Confirm recorded consent per purpose and channel or another valid basis (verify soft opt-in rules per country), claims and banned-phrase checks on copy, working opt-out, platform windows and templates, and no incentivised or filtered review requests where banned.  
  **Done when:** Each campaign type has a signed approval and a test run sends nothing to anyone without consent.
- [ ] **P5-07** Automate aftercare check-ins and review/referral requests through consented channels  
  _Builder · Apps, analytics & retention · effort M · after P3-44, P4-08, P4-16, P2-45, P5-06 · needs Q1, Q2, Q7_  
  Schedule check-ins from each procedure's protocol via consented WhatsApp templates, SMS or email, never DMs outside the window; any reply mentioning symptoms, pain or a complaint pauses automation and goes to a clinician or manager. After completion with no open complaint, ask for genuine reviews without incentives and issue tracked referral codes once the legal reviewer has checked referral rules.  
  **Done when:** Day-1/7/30 check-ins send on time in tests, a symptom reply creates a clinician task within 1 minute with AI paused, and a referral code links a new lead to the referrer.
- [ ] **P5-08** Build consented win-back and anniversary campaigns with suppression  
  _Builder · Apps, analytics & retention · effort M · after P5-06, P2-29, P2-38, P4-16 · needs Q1, Q7_  
  Target only clients with recorded marketing consent for the channel; exclude do-not-contact, erased and complaint records; apply frequency caps, STOP handling and WhatsApp marketing templates only with opt-in. Copy passes claims and banned-phrase checks and needs owner approval.  
  **Done when:** The audience query returns no one without channel consent, an opt-out stops further sends, and the owner approves the first campaign.
- [ ] **P5-09** Schedule the weekly incremental extraction and outcome refresh  
  _Builder · History & playbook · effort M · after P1-19, P4-13, P4-03, P3-07_  
  A weekly job masks closed live episodes with the same masker, extracts them via the Batch API with the same schema version, pulls new bookings and payments, relabels changed outcomes and updates aggregates.  
  **Done when:** It runs two weeks in a row, processes all closed episodes with under 1% failures and logs cost per run.
- [ ] **P5-10** Generate weekly evidence-backed playbook proposals into the approval queue  
  _Builder · History & playbook · effort M · after P5-09, P2-56, P4-27_  
  Claude compares new aggregates and edit patterns with the active playbook and drafts proposals with n, effect, CI and example episode IDs, suggesting an A/B test where evidence is weak. Proposals must pass lint and the eval gate, and nothing applies automatically.  
  **Done when:** Two weekly runs post proposals (or 'no change') with all evidence fields, and approving one creates a new version with a changelog.
- [ ] **P5-11** Add A/B testing of approved playbook wording  
  _Builder · History & playbook · effort M · after P5-10_  
  Deterministic assignment by lead-id hash, approved and linted variants only, one primary metric (e.g. number shared within 7 days) and one secondary (booked), sample size and stopping rule fixed in advance, and at most two tests per workspace.  
  **Done when:** A staging test with simulated traffic reaches its stopping rule and produces a report with effect size and CI.
- [ ] **P5-12** Extend autopilot to further intents, languages and TikTok, and track the automated-reply share  
  _Both · Channels & AI replies · effort M · after P3-40, P3-35, P3-08, P2-57, P5-04 · needs Q9_  
  P3-40 stops at the first Instagram intent set and no task takes TikTok through an autopilot gate, so 'minimum human involvement' and 'instant replies to all messages' are left unfinished. Every 2-4 weeks, use the signed P2-57 criteria, nightly QA and the weekly AI review to propose the next intents and languages for autopilot. Run TikTok on the API or partner route through its own co-pilot-to-autopilot gate; manual mode stays human-sent. Report the share of inbound DMs answered without a human and the median first-reply time per channel against an owner-set target. Clinical, minor and complaint intents stay with humans by design.  
  **Done when:** Each added intent, language and channel has a signed expansion record with metric evidence, TikTok on an API or partner route has passed its autopilot gate (or the manual-mode limit is recorded), and the monthly report shows the automated-reply share and first-reply time against the owner's target.
- [ ] **P5-13** Document the history pipeline and dry-run it for a second workspace  
  _Builder · History & playbook · effort S · after P1-19, P1-21, P2-11_  
  A runbook from exports to playbook drafting and eval, parameterised by workspace, dry-run on synthetic exports for a dummy workspace.  
  **Done when:** The dummy workspace completes the pipeline from the runbook alone with no rows or objects crossing workspaces.
- [ ] **P5-14** Add signed outbound webhooks for n8n or Zapier  
  _Builder · Core platform · effort S · after P2-13, P2-12_  
  Admins subscribe URLs to selected events (lead created, stage changed, appointment booked); deliveries are HMAC-signed, retried with backoff, logged, and masked so clinical data never leaves.  
  **Done when:** A test n8n workflow receives a signed stage-change event, a failing endpoint is retried and logged, and no payload contains clinical fields.
- [ ] **P5-15** Build optional consented call recording and transcripts if the organisation opts in  
  _Both · Core platform · effort M · after P2-70, P0-31, P3-36, P2-12, P2-67, P2-42 · needs Q1, Q5_  
  The feature map promises optional recording and transcripts with consent, but P2-42 leaves recording unbuilt and nothing picks it up later. Only if the owner opts in under the P2-70 policy: record through the telephony chosen in P0-31 (VoIP or phone-system API), play the approved notice and continue unrecorded on refusal, and store recordings in restricted R2 linked to the call and lead. Transcribe with the P3-36 engine, show audio and transcript only to permitted roles, add a masked summary to the call notes, and apply the retention schedule and erase jobs.  
  **Done when:** Either the owner's written 'no recording' decision closes the task, or a test call is recorded after the notice, transcribed, visible only to permitted roles, and removed by the erase job.
- [ ] **P5-16** Decide how additional organisations connect Instagram  
  _Both · Accounts & approvals · effort S · after P0-04, P3-26_  
  A Meta app per organisation means separate verification, App Review, secret and callback each time; one operator app serving many businesses changes the developer of record and what Meta reviews (verify Tech Provider rules). Align the gateway's per-workspace credential storage with the choice.  
  **Done when:** A merged ADR names the model, the per-org onboarding steps and any Meta review required.
- [ ] **P5-17** Draft the multi-organisation contract pack  
  _Both · Legal & compliance · effort M · after P0-16, P0-14_  
  Terms of service or MSA, an Art. 28 DPA template, a public sub-processor page with change notice, an acceptable-use policy including the minors rules, a security and tenant-isolation statement, export and deletion at termination, liability terms and a BAA policy for US customers, reviewed by a lawyer.  
  **Done when:** The lawyer-reviewed pack is ready and the sub-processor page is published.
- [ ] **P5-18** Build the operator console with audited, time-limited support access  
  _Builder · Core platform · effort M · after P2-11, P3-03, P0-04_  
  A cross-workspace view of health, usage, cost, feature flags, channel status and provisioning with no client data; support access is an org-approved, expiring, fully audited break-glass grant.  
  **Done when:** The operator sees per-workspace health and cost without client data, and a support session needs approval, expires and appears in that org's audit log.
- [ ] **P5-19** Meter per-workspace usage and set up billing  
  _Both · Core platform · effort M · after P2-75, P5-17_  
  Attribute Claude tokens, SMS and WhatsApp messages, storage and seats to each workspace, agree the pricing model, and invoice monthly through a billing provider per the contract pack.  
  **Done when:** A month of usage for two workspaces reconciles with provider invoices within 2% and a test invoice is issued.
- [ ] **P5-20** Package the onboarding template for the next organisation  
  _Both · Launch & operations · effort M · after P5-17, P2-11, P4-37, P5-16, P5-13_  
  A provisioning script (workspace, roles, ladders, empty playbook, master-data import) plus an org checklist reusing P0 (Meta connection and verification, App Review, TikTok check, exports, price list, consent forms, roster, app enrolment), the Q1-Q9 questionnaire, a compliance checklist (scope memo, DPIA addendum, privacy notice, claims and banned lists, clinician owner, residency) and a timeline.  
  **Done when:** A dummy organisation is provisioned in under an hour, a cross-tenant test is refused, and the checklist and questionnaire are published.
- [ ] **P5-21** Sign organisation 2 and complete its contracts and compliance onboarding  
  _Both · Launch & operations · effort M · after P5-20_  
  Signed MSA and DPA, Q1-Q9 answers, scope memo and DPIA addendum, Meta connection and verification, TikTok eligibility, export requests, a price list and a named clinician sign-off owner.  
  **Done when:** Org 2's contracts and checklist are filed and its platform applications are submitted.
- [ ] **P5-22** Provision organisation 2, run its history pipeline and start shadow mode  
  _Both · Launch & operations · effort M · after P5-21, P0-18_  
  Provision in org 2's chosen residency, load staff, rota and master data, run the history pipeline for its own playbook, connect channels once approved and start shadow, logging template gaps.  
  **Done when:** Org 2 runs in shadow with cross-tenant tests green and the onboarding template updated.
- [ ] **P5-23** Hand over admin control and reduce the builder's access to the agreed least privilege  
  _Both · Accounts & approvals · effort S · after P0-09, P2-04, P3-15_  
  Org admins log into every account in the register, confirm 2FA and recovery, and rotate at least one production key themselves using the runbook; the builder is then downgraded or removed as the organisation decides.  
  **Done when:** Every register row shows admins verified by a live login and the builder at the agreed level, with the owner's dated sign-off.

## Ongoing · Run and govern (From co-pilot go-live (about week 9) onward)

Exit criteria:

- Weekly AI review held and every playbook proposal decided within 7 days
- Monthly service review and restore drill logged
- Quarterly access attestation, secret rotation and policy/API watch logged

- [ ] **OP-01** Operate the platform on weekly, monthly and quarterly cadences  
  _Both · Launch & operations · effort S · after P3-15, P2-74, P2-04, P0-09_  
  Weekly: merge dependency updates and triage alerts and DLQs. Monthly: service review (uptime vs SLA, incidents, coordinator SLAs, nightly QA findings, cost vs budget), a restore drill and a compatibility_date bump via staging. Quarterly: remove leavers (always within 24 h of departure), review users, grants, MCP tokens, API keys and admins on every vendor account, rotate secrets per the inventory, check renewals and re-run the security checklist. Yearly: an app admin completes Meta's Data Use Checkup before its deadline (missing it deactivates the app and every permission must go back through App Review), and Business Verification, app roles and the privacy and deletion URLs are confirmed current.  
  **Done when:** The ops log has a dated entry for every cadence, each quarter has an owner-signed access attestation, no secret exceeds its rotation period, and Meta's Data Use Checkup is completed each year before its deadline.
- [ ] **OP-02** Run the playbook and compliance governance cadence  
  _Organisation · History & playbook · effort S · after P1-30, P1-42, P1-39_  
  Weekly: the playbook owner decides every queued proposal within 7 days with reasons, with clinician sign-off on clinical items, and rejected ideas are recorded. Monthly: review claims, banned phrases and the price list and retire expired items. Yearly or after a major change: review the DPIA, ROPA, retention schedule and training.  
  **Done when:** The change log shows a decision on every proposal within 7 days and clinician sign-off on every clinical change, plus dated monthly and annual reviews.
- [ ] **OP-03** Hold a weekly AI channel review  
  _Both · Channels & AI replies · effort S · after P3-05, P2-56, P3-08_  
  Review handoff reasons, guardrail blocks, refusals, co-pilot edits, nightly QA findings and cost, and re-tune thresholds through PRs that must pass the eval gate.  
  **Done when:** A review note with actions is logged every week.
- [ ] **OP-04** Run the quarterly policy, regulation and platform API watch  
  _Builder · Legal & compliance · effort S · after P0-13, P0-14_  
  Check Meta Platform Terms and messaging policy, Graph API version deprecations, TikTok terms, eligibility and API versions, WhatsApp policy, the Anthropic Usage Policy and terms, Cloudflare terms, sub-processors and the laws in the scope memo, and open a task for each change.  
  **Done when:** Each quarter has a dated entry with findings and follow-up tasks, and no deprecated API version is in use.
- [ ] **OP-05** Track Claude model and API changes and gate every change on the evals  
  _Builder · Channels & AI replies · effort S · after P2-56_  
  Watch deprecations and release notes for every model and beta in use (reply engine, call brief, extraction, jobs). Before changing model, effort or beta header, run the eval and red-team suites, compare cost and latency, and get the owner's sign-off.  
  **Done when:** A dated model register lists each route's model, beta headers and retirement dates, and every change links to an eval report.
