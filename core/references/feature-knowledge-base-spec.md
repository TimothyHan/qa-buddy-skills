# Feature Knowledge Base Specification
<!-- qab: scope=all -->

The feature knowledge base is a structured repository of processed feature context.
It eliminates redundant Jira/Confluence queries by storing consolidated, AI-readable
summaries of every feature the team works on.

**Version:** 0.2.0
**Last updated:** 2026-04-02
**Status:** Spec — not yet implemented

---

## 1. Problem
<!-- qab: id=problem -->

Every time a skill needs to understand a feature, it queries Jira (epic, stories,
tasks, comments), Confluence (PRDs, design docs), and potentially Figma. This is:

- **Slow:** 5-10 API calls per feature, per skill invocation.
- **Expensive:** Token-heavy. The same feature gets re-analyzed across `/test-plan`,
  `/test-cases`, `/qa`, and `/sprint-status`.
- **Lossy:** Context from discussions, design decisions, and edge case debates in
  Jira comments gets re-parsed inconsistently each time.

## 2. Solution
<!-- qab: id=solution -->

A versioned knowledge base that stores **processed, consolidated feature context**.
Skills read from the knowledge base first and query Jira only for what's missing
or has changed.

The knowledge base is maintained by AI through skills. When a skill analyzes a
feature, it creates or updates the knowledge base entry via PR (requires SDT or
dev review before merge).

---

## 3. Storage Location
<!-- qab: id=storage-location -->

The knowledge base location is configurable. Skills reference it through a
resolved path, not a hardcoded location.

### Resolution Order

1. **Check for config in `.claude/settings.local.json`:**
   ```json
   { "featuresKbPath": "/path/to/knowledge-base" }
   ```

2. **Check for `features-kb/` in the current repo root:**
   ```bash
   git rev-parse --show-toplevel 2>/dev/null
   ```
   If `features-kb/` exists there, use it.

3. **If neither found:** Ask the user where to create it.

### Deployment Options

| Option | Config | When to use |
|--------|--------|-------------|
| **Same repo** | `features-kb/` in repo root | Single-service team, starting out |
| **Standalone repo** | Absolute path or git URL in settings | Multi-service team, cross-service features |

When a feature spans multiple services, create a **separate standalone repo** for the KB.

Skills should never hardcode the path. Always resolve it.

---

## 4. What Gets Stored (Processed Data Only)
<!-- qab: id=what-gets-stored -->

The KB stores **processed summaries only**, not raw Jira exports. "Processed" means
the AI has read, consolidated, and structured the information into a consistent format.

### 4.1 Per Epic (feature-level)

| Data | Source | What's stored |
|------|--------|--------------|
| Feature description | Jira epic description + Confluence PRDs | Consolidated summary: what, why, who, user impact |
| Feature details | Jira epic fields, labels, components | Status, sprint, fix version, component tags |
| Children ticket references | Jira linked stories/tasks | Ticket keys, titles, types, status (references only, detail lives in ticket files) |
| Capabilities (CAPs) | Jira epic ACs + PRD requirements | Structured list of what the feature enables |
| Test plan | `/test-plan` output | Strategy, automation gaps, success criteria, risks |
| Feature relations | Cross-referencing with other epics | Links to related features, regression risk |

### 4.2 Per Story / Task (ticket-level)

| Data | Source | What's stored |
|------|--------|--------------|
| Acceptance criteria (ACs) | Jira ticket ACs | Structured ACs with testability and test layer assignment |
| Test cases | `/test-cases` output | E2E scenarios, unit test checklist, manual test cases |

### 4.3 Cross-Feature (KB-level)

| Data | Source | What's stored |
|------|--------|--------------|
| Test case to AC mapping | `/test-cases` output | Which test cases cover which ACs, coverage status |
| Feature map | Automatic detection + manual input | Feature dependency graph with regression risk scoring |

---

## 5. Directory Structure
<!-- qab: id=directory-structure -->

```
features-kb/
├── config.json                          # KB configuration
├── LEARNINGS.md                         # Project learnings (self-improve.md); committed
├── learnings-log.jsonl                  # Append-only run log: applied/contradicted/captured/outcome; committed
├── index.json                           # Feature index for fast lookup
├── features/
│   ├── {EPIC-KEY}/
│   │   ├── feature.md                   # Consolidated feature context (§4.1)
│   │   ├── test-plan.md                 # Test plan (from /test-plan)
│   │   ├── tickets/
│   │   │   ├── {TICKET-KEY}.md          # Per-ticket ACs + context (§4.2)
│   │   │   └── ...
│   │   ├── test-cases/
│   │   │   ├── {TICKET-KEY}.md          # Test cases (from /test-cases)
│   │   │   ├── {TICKET-KEY}-mapping.json # AC-to-test-case mapping (§4.3)
│   │   │   └── ...
│   │   ├── reviews/
│   │   │   ├── {TICKET-KEY}-review.md   # Ticket review (from /review-ticket)
│   │   │   └── ...
│   │   └── qa-reports/
│   │       ├── {TICKET-KEY}-{DATE}.md   # QA reports
│   │       └── ...
│   └── ...
└── relations/
    ├── feature-map.json                 # Feature dependency graph (§4.3)
    └── regression-map.json              # Regression test mapping
```

---

## 6. File Schemas
<!-- qab: id=file-schemas -->

### 6.1 config.json

```json
{
  "version": "0.2.0",
  "source": "jira",
  "jiraProject": "PROJ",
  "confluenceSpace": "TEAM",
  "lastSync": "2026-04-02T10:00:00Z",
  "storageMode": "same-repo",
  "syncThresholdHours": 24,
  "retentionPolicy": "until-feature-retired"
}
```

### 6.2 index.json

Fast lookup index. Skills read this first to find features without scanning
the directory tree.

```json
{
  "lastUpdated": "2026-04-02T10:00:00Z",
  "features": {
    "EPIC-100": {
      "title": "Invoice Management Redesign",
      "status": "in-progress",
      "sprint": "Sprint 24",
      "tickets": ["PROJ-101", "PROJ-102", "PROJ-103"],
      "capabilities": ["Create invoices", "Edit invoices", "Invoice PDF export"],
      "hasTestPlan": true,
      "testCaseCount": 12,
      "acCount": 15,
      "acCovered": 12,
      "lastUpdated": "2026-04-01T14:30:00Z",
      "tags": ["billing", "invoicing", "ui-redesign"]
    },
    "EPIC-200": {
      "title": "SSO Integration",
      "status": "planned",
      "sprint": null,
      "tickets": ["PROJ-201", "PROJ-202"],
      "capabilities": ["SAML SSO login", "SSO user provisioning"],
      "hasTestPlan": false,
      "testCaseCount": 0,
      "acCount": 8,
      "acCovered": 0,
      "lastUpdated": "2026-03-28T09:00:00Z",
      "tags": ["auth", "sso", "security"]
    }
  }
}
```

### 6.3 feature.md (per epic)

The consolidated feature context document. This is what skills read instead of
querying Jira + Confluence from scratch.

```markdown
# Feature: {Epic title}

**Epic:** {EPIC-KEY}
**Status:** {planning | in-progress | testing | released | retired}
**Sprint:** {sprint name or "backlog"}
**Last synced from Jira:** {YYYY-MM-DD HH:MM}

---

## Summary
{2-3 paragraph consolidated summary of what this feature does, why it exists,
and who it's for. Written from the processed Jira epic description, PRD, and
team discussions.}

## Capabilities (CAPs)
{What this feature enables. Each CAP is a distinct capability the feature delivers.}

| # | Capability | Tickets | Status |
|---|-----------|---------|--------|
| CAP-1 | {capability description} | PROJ-101, PROJ-102 | {not started / in progress / done} |
| CAP-2 | {capability description} | PROJ-103 | {status} |

## Children Tickets

| Ticket | Type | Title | Status | ACs | Test Cases |
|--------|------|-------|--------|-----|-----------|
| PROJ-101 | Story | {title} | In Progress | 5 | 3 |
| PROJ-102 | Story | {title} | To Do | 3 | 0 |
| PROJ-103 | Task | {title} | Done | 2 | 2 |

## Acceptance Criteria (aggregated)

All ACs from all tickets under this epic, consolidated:

| # | AC | Ticket | Layer | Test Case | Status |
|---|-----|--------|-------|-----------|--------|
| AC1 | {Given... When... Then...} | PROJ-101 | E2E | TC-001 | {not tested / passed / failed} |
| AC2 | {AC text} | PROJ-101 | Unit | TC-002 | {status} |
| AC3 | {AC text} | PROJ-102 | API | — | {not covered} |

## Design & Architecture
{Key design decisions, architecture notes, data model changes. Sourced from
Confluence docs and Jira comments.}

### Figma / Mockups
- {link 1: description}
- {link 2: description}

### Confluence Docs
- {link 1: title}
- {link 2: title}

## Key Decisions
{Important decisions made during grooming/refinement that affect testing.
Sourced from Jira comments and team discussions.}

1. {Decision 1: what was decided and why}
2. {Decision 2: what was decided and why}

## Known Edge Cases
{Edge cases identified during review or testing}

1. {Edge case 1}
2. {Edge case 2}

## Related Features
{Features that interact with this one, sourced from relations/feature-map.json}

- {EPIC-50: Feature name} — {relation type} — {how they interact}
- {EPIC-75: Feature name} — {relation type} — {how they interact}

## Change Log
| Date | What changed | Source | Updated by |
|------|-------------|--------|-----------|
| 2026-04-02 | Initial creation from /test-plan | Jira EPIC-100 | Claude |
| 2026-04-03 | Updated ACs after grooming | /review-ticket PROJ-102 | Claude |
```

### 6.4 tickets/{TICKET-KEY}.md

Per-ticket context. Focused on ACs and test coverage.

```markdown
# {TICKET-KEY}: {Title}

**Type:** {story | bug | task}
**Epic:** {EPIC-KEY}
**Status:** {status from Jira}
**Sprint:** {sprint name}
**Last synced:** {YYYY-MM-DD HH:MM}

## Description
{Processed ticket description}

## Acceptance Criteria

| # | AC | Testable? | Test Layer | Test Case | Status |
|---|-----|----------|-----------|-----------|--------|
| 1 | {AC text} | Yes | E2E | TC-001 | Passed |
| 2 | {AC text} | Partial | Unit + Manual | TC-002, TC-003 | Not tested |

## Notes
{Key context from comments, design discussions, refinement notes}
```

### 6.5 test-cases/{TICKET-KEY}-mapping.json

AC-to-test-case traceability mapping.

```json
{
  "ticket": "PROJ-101",
  "epic": "EPIC-100",
  "lastUpdated": "2026-04-02T10:00:00Z",
  "mappings": [
    {
      "ac": "AC #1: User can create an invoice with valid data",
      "testCases": [
        { "id": "TC-001", "layer": "e2e", "type": "happy-path", "status": "passed" },
        { "id": "TC-002", "layer": "e2e", "type": "negative", "status": "passed" }
      ],
      "unitTests": ["invoice-creation-valid-data", "invoice-validation-required-fields"],
      "coverage": "full"
    },
    {
      "ac": "AC #2: Error message shown for invalid amount",
      "testCases": [
        { "id": "TC-003", "layer": "unit", "type": "negative", "status": "not-run" }
      ],
      "unitTests": ["amount-validation-negative", "amount-validation-zero"],
      "coverage": "full"
    }
  ],
  "unmappedACs": [],
  "testGaps": []
}
```

### 6.6 relations/feature-map.json

Tracks which features relate to each other.

```json
{
  "lastUpdated": "2026-04-02T10:00:00Z",
  "relations": [
    {
      "from": "EPIC-100",
      "to": "EPIC-50",
      "type": "extends",
      "description": "Invoice redesign changes the invoice creation flow that EPIC-50 originally built",
      "regressionRisk": "high",
      "sharedComponents": ["InvoiceForm", "BillingAPI", "invoice_items table"]
    }
  ]
}
```

**Relation types:**
- `extends` — new feature builds on an existing feature
- `depends-on` — new feature requires another feature to work
- `modifies` — new feature changes behavior of an existing feature
- `replaces` — new feature replaces an existing feature
- `adjacent` — features share components but are functionally independent

### 6.7 relations/regression-map.json

Derived from the feature map. Lists which tests to run when a feature changes.

```json
{
  "lastUpdated": "2026-04-02T10:00:00Z",
  "regressionPaths": [
    {
      "trigger": "EPIC-100",
      "affectedFeatures": ["EPIC-50"],
      "testCasesToRun": ["EPIC-50/TC-001", "EPIC-50/TC-003", "EPIC-50/TC-007"],
      "reason": "Invoice redesign shares InvoiceForm and BillingAPI with EPIC-50"
    }
  ]
}
```

---

## 7. Read/Write Protocol
<!-- qab: id=read-write-protocol -->

### 7.1 Reading (every skill)

On every skill invocation, check the knowledge base:

```
1. Resolve KB path (see §3)
2. Read index.json for feature lookup
3. If feature exists and lastUpdated is recent (< 24 hours):
   → Read feature.md and relevant sub-files
   → Use KB data as primary context
   → Query Jira only for: ticket status changes, new comments since lastUpdated
4. If feature exists but stale (> 24 hours):
   → Read feature.md for baseline context
   → Query Jira for updates since lastUpdated
   → Update feature.md with new information (via PR)
5. If feature does not exist:
   → Full Jira query
   → Create feature.md and sub-files (via PR)
```

**Staleness threshold:** 24 hours by default. Configurable in config.json.
**Check frequency:** Every skill invocation.
Skills that need real-time status (like `/sprint-status`) should always
check Jira for ticket status even if the KB is fresh.

### 7.2 Writing (skills that create or update knowledge)

All KB updates go through PR review:

1. **Determine what changed** — new feature entry? Updated ACs? New test cases?
2. **Create a branch:** `kb-update/{EPIC-KEY}/{date}` or `kb-update/{TICKET-KEY}/{date}`
3. **Update the relevant files** in `features-kb/`
4. **Update index.json** with new metadata
5. **Update relations/** if new feature connections were discovered
6. **Create a PR** with the changes
7. **PR requires review** from SDT or developer before merge

If multiple skills run in sequence on the same feature, batch updates into
a single PR where possible.

### 7.3 Which Skills Write What

| Skill | Creates/Updates |
|-------|----------------|
| `/test-plan` | `feature.md`, `test-plan.md`, `index.json`, `relations/` |
| `/review-ticket` | `tickets/{KEY}.md`, `reviews/{KEY}-review.md`, `feature.md` (adds edge cases) |
| `/test-cases` | `test-cases/{KEY}.md`, `test-cases/{KEY}-mapping.json`, `index.json` (testCaseCount, acCovered) |
| `/qa` | `qa-reports/`, `feature.md` (updates AC test status), `tickets/{KEY}.md` (updates test status) |
| `/verify-fix` | `qa-reports/{BUG-KEY}-verify-{DATE}.md`, bug status updates |
| `/sprint-status` | `index.json` (status updates) |
| `/exploratory` | `feature.md` (adds discovered edge cases), `test-cases/` (new scenarios) |

---

## 8. Feature Relation Discovery
<!-- qab: id=feature-relation-discovery -->

How skills discover and maintain feature relations:

### 8.1 Automatic Detection

When processing a feature, look for signals of relation:

- **Shared Jira labels or components** between epics
- **Shared code:** If test cases from different epics reference the same
  pages, components, or API endpoints
- **Jira links:** Epic-to-epic links in Jira (blocks, relates-to)
- **Shared database tables:** If features modify the same data entities

### 8.2 Regression Risk Scoring

| Risk Level | Criteria |
|-----------|---------|
| **High** | Features share core components or data models. Change in one directly affects the other. |
| **Medium** | Features share secondary components. Change might affect the other under certain conditions. |
| **Low** | Features are adjacent but independent. Unlikely to affect each other. |

### 8.3 How Skills Use Relations

- `/test-plan` — Check feature-map.json for related features. Include regression
  testing for high-risk relations.
- `/test-cases` — Add regression scenarios from regression-map.json.
- `/qa` — After fixing a bug, check regression-map.json for affected features.
- `/sprint-status` — Show features at risk of regression based on current dev work.

---

## 9. Sync Strategy
<!-- qab: id=sync-strategy -->

### 9.1 Jira as Source of Truth

Jira remains the source of truth for:
- Ticket status (To Do, In Progress, Done)
- Current sprint assignment
- New tickets added to an epic
- New comments and discussions
- Acceptance criteria text

The knowledge base is a **processed cache**, not a replacement. If there's a
conflict between Jira and the KB, Jira wins for these fields.

### 9.2 KB as Source of Truth

The knowledge base is the source of truth for:
- Consolidated feature summaries (processed from multiple Jira sources)
- Capabilities (CAPs)
- Test plans and test cases
- AC-to-test-case mappings
- Feature relations and regression maps
- Edge cases discovered during testing
- Test execution status

These are artifacts that don't exist in Jira.

### 9.3 Conflict Resolution

If a skill detects a discrepancy between Jira and the KB:
1. Jira data wins for: ticket status, ACs text, sprint assignment
2. KB data wins for: test artifacts, relations, processed summaries, CAPs
3. Flag the discrepancy in the PR: "AC #3 changed in Jira since last sync"

---

## 10. Retention Policy
<!-- qab: id=retention-policy -->

**Keep knowledge until the feature retires from the service.**

This is a long-living knowledge base. Features are not archived or deleted
after release. They remain as context for:
- Regression testing (understanding what existing features do)
- New feature planning (understanding how new work relates to existing features)
- Onboarding (new team members understanding the product)

### Feature Status Lifecycle

```
planning -> in-progress -> testing -> released -> retired
```

Only features with status `retired` can be considered for cleanup, and only
after confirming no other feature depends on them (check feature-map.json).

---

## 11. Migration Path
<!-- qab: id=migration-path -->

### Phase 1: Same Repo (starting point)
- `features-kb/` in the service repo
- Skills create PRs for KB updates (requires SDT/dev review)

### Phase 2: Standalone Repo (when needed)
- Triggered when: cross-service features appear, or KB grows large
- Separate GitHub repo
- Same PR review workflow
- CI validates KB schema on PR

### Migration Steps
1. Create standalone repo with same directory structure
2. Copy `features-kb/` contents
3. Update config: `featuresKbPath` in `.claude/settings.local.json`
4. Skills automatically use the new location
5. Remove `features-kb/` from service repo
