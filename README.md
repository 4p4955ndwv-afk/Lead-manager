# Lead Manager

A Claude-run lead and client management system for organisations that win clients through
Instagram and TikTok DMs and then land them for in-person appointments, multi-procedure
treatment plans, sessions, aftercare and return visits.

## Status

Planning. The plan below is awaiting approval; nothing has been built or connected yet.

- Plan: [`docs/blueprint.html`](docs/blueprint.html) (open in a browser)
- Open questions to answer before the build starts: section 13 of the plan

## Planned stack

- Cloudflare Workers, D1, R2, Queues and Durable Objects
- Official Instagram Messaging API and TikTok Business Messaging API
- Claude API for real-time replies and batch analysis of past DMs
- Remote MCP server so Claude can monitor and operate the system
- One web app (installable PWA), later wrapped as private iOS and Android apps
