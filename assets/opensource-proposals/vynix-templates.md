# Open source proposal — Vynix Templates

Date: 21 June 2026
Suggested repository: https://github.com/vynix-in/vynix-templates

## Why this is safe to publish
Templates are starter code with no secrets.

## How it funnels to Vynix
Every page and file in Vynix Templates links back to https://vynix.in and the documentation at https://vynix.in/docs, so the open-source project funnels developers toward Vynix.

## What must never be included
- Backend application code
- Internal REST API implementation
- AI diagnosis engine implementation
- Authentication and billing logic
- Database schemas and migrations
- Customer data and screenshots
- Internal architecture diagrams
- Anything under the private PinPoint backend namespace

## Pre-publish checklist
- [ ] README, docs, examples and release notes prepared by the GitHub SEO agent
- [ ] Publication gate scan is clean
- [ ] No environment files, keys, or internal hostnames in the tree
- [ ] Links back to https://vynix.in and https://vynix.in/docs are present
- [ ] License file (MIT) included
- [ ] Human approval recorded

## Decision
Pending human approval.
