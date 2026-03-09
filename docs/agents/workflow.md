# INITIATIVE WORKFLOW
> The flow of work, agent routing, and state management for agents/

**NOTE:** This workflow is currently executed manually via step-by-step orchestration.

---

## 🗺️ Master Routing Diagram
*How an initiative flows from concept to implementation.*

```graph TD
%% Styling
classDef user fill:#f9f,stroke:#333,stroke-width:2px;
classDef agent fill:#bbf,stroke:#333,stroke-width:1px;
classDef review fill:#fdb,stroke:#333,stroke-width:1px;

User([User Prompt]):::user --> CLAR[Prompt Clarifier]:::agent
CLAR --> HITL_CLAR{User Confirms Understanding}:::user
HITL_CLAR -- Refines --> CLAR

HITL_CLAR -- Confirms --> HLP[High-Level Planner]:::agent
HLP --> HITL_PLAN{User Approves Plan Direction}:::user
HITL_PLAN -- Rejects --> HLP

HITL_PLAN -- Approves --> CG[Context Gatherer]:::agent
CG --> HLR{HL Reviewer + Context}:::review
HLR -- Rejects --> HLP

HLR -- Approves --> LLP[Low-Level Planner]:::agent
LLP --> LLR{LL Reviewer}:::review
LLR -- Rejects --> LLP

LLR -- Approves --> TW[Test Writer]:::agent
TW --> TR{Test Reviewer}:::review
TR -- Rejects --> TW

TR -- Approves --> HITL{User HITL Gate}:::user
HITL -- Rejects --> TW

HITL -- Approves --> IMP[Implementer]:::agent
IMP --> IMR{Implement Reviewer}:::review
IMR -- Rejects --> IMP
IMR -- Approves --> Done([Initiative Implementation Complete])
```

---

## Phase 0: Planning
### Project Initiative docs/agents/<initiative-title>/plans/ Structure
```
└╴󰝰 <initiative-title>
    └╴󰝰 plans
      ├╴󰍔 requirements-understanding.md
      ├╴󰍔 context.md
      ├╴󰍔 high-level-plan.md
      ├╴󰍔 low-level-plan.md
      ├╴󰝰 high-level-plans
      │ └╴󰝰 high-level-0001
      │   ├╴󰍔 high-level-plan.md
      │   └╴󰍔 high-level-revisions.md
      └╴󰝰 low-level-plans
        └╴󰝰 low-level-0001
          ├╴󰍔 low-level-plan.md
          └╴󰍔 low-level-revisions.md
```

### 0.1) Prompt Refinement & User Confirmation
* Agent: agents/initiative/planning/clarifier.md
* Input Necessary: User's raw initiative prompt + project-context.md.
* Process: Reads the user's prompt and the static project overview, produces a structured Requirements Understanding Document with clarifying questions.
* Output: Writes to <initiative-title>/plans/requirements-understanding.md.
* 🛑 HITL Gate: User reviews the understanding document.
    * If Confirmed: The confirmed requirements understanding becomes an input for the High-Level Planner. Move to step 0.2.
    * If Refined: User provides corrections/answers. Clarifier produces updated understanding. Repeat until confirmed.

### 0.2) High-Level Planning & User Approval
* Agent: agents/initiative/planning/high-level.md
* Input Necessary: Confirmed requirements-understanding.md + project-context.md. On revisions after reviewer rejection: also plans/context.md + reviewer's high-level-revisions.md.
* Process: Drafts a broad, milestone-based architectural plan grounded in the project's tech stack and structure.
* 🛑 HITL Gate (first attempt only): User reviews the plan direction.
    * If Approved: Save draft to <initiative-title>/plans/high-level-plans/high-level-NNNN/high-level-plan.md. Move to Context Gathering (step 0.3).
    * If Rejected: User provides feedback. Planner generates a revised plan in high-level-{N+1}/. Repeat until approved.
* On revision after HL Reviewer rejection: The revised plan skips the user HITL gate and Context Gathering (both already completed) and routes directly back to the HL Reviewer (step 0.4).

### 0.3) Targeted Context Gathering
* Agent: agents/initiative/planning/context-gatherer.md
* Input Necessary: The user-approved high-level plan from step 0.2.
* Process: Uses the approved high-level plan to search the codebase. Identifies specific files, existing patterns, and dependencies.
* Output: Writes findings to <initiative-title>/plans/context.md.

### 0.4) High-Level Plan Review (with Codebase Context)
* Agent: agents/initiative/planning/reviewer/high-level.md
* Input Necessary: The user-approved high-level plan + plans/context.md.
* Process: Reviews the plan against the user's goals AND the gathered codebase context to catch misconceptions, hallucinated assumptions, or integration conflicts.
* Routing Logic:
    * If Approved: Copy final plan to <initiative-title>/plans/high-level-plan.md. Move to Low-Level Planning (step 0.5).
    * If Rejected: Reviewer writes high-level-revisions.md inside high-level-NNNN/. Plan loops back to HL Planner (step 0.2) with the context and revision feedback as additional inputs. The planner's revised plan routes directly back here (skipping user HITL and context gathering). Repeat until approved.

### 0.5) Low-Level Planning & Review
* Agent: agents/initiative/planning/low-level.md
* Input Necessary: Finalized high-level-plan.md + context.md.
* Process: Drafts highly specific, step-by-step implementation instructions utilizing the gathered codebase context to prevent hallucinations.
* Review Agent: agents/initiative/planning/reviewer/low-level.md
* Routing Logic:
    * If Approved: Save final draft to <initiative-title>/plans/low-level-plan.md. Move to Phase 1.
    * If Rejected: Reviewer writes low-level-revisions.md inside low-level-NNNN/. Planner generates new plan in low-level-{N+1}/. Repeat until approved.

---

## Phase 1: Initiative Tests (with HITL)
### Project Initiative docs/agents/<initiative-title>/tests/ Structure
```
└╴󰝰 <initiative-title>
  └╴󰝰 tests
    ├╴󰌞 <initiative-title>.{spec,test,cy}.{js,jsx,ts,tsx}
    ├╴󰝰 <initiative-title>-tests-0001
    │ ├╴󰌞 <initiative-title>.{spec,test,cy}.{js,jsx,ts,tsx}
    │ └╴󰍔 revisions.md
```

### 1.1) Test Writing & Agent Review
* Agent: agents/initiative/planning/testers/writer.md
* Input Necessary: Finalized low-level-plan.md.
* Process: Generates automated tests covering the logic outlined in the low-level plan.
* Review Agent: agents/initiative/planning/testers/reviewer.md
* Routing Logic:
    * If Rejected: Reviewer writes revisions.md in tests-0001/. Writer tries again in tests-0002/.
    * If Approved by Agent: Pauses workflow and moves to HITL Validation.

### 1.2) 🛑 Human-In-The-Loop (HITL) Validation
* Process: The user is prompted to review the agent-approved tests.
* Routing Logic:
    * User Rejects: User provides text feedback. Writer loops back to generate tests-####/.
    * User Approves: The test file is finalized and written to the root of <initiative-title>/tests/. Move to Phase 2.

---

## Phase 2: Implementation
### Project Initiative docs/agents/<initiative-title>/implementation/ Structure
```
└╴󰝰 <initiative-title>
  ├╴󰍔 final-report.md
  └╴󰝰 implementation
    ├╴󰝰 implementation-0001
    │ ├╴󰍔 log.md
    │ └╴󰍔 revisions.md
```

### 2.1) Execution & Review
* Agent: agents/initiative/implement/implementer.md
* Input Necessary: low-level-plan.md, context.md, and the user-validated <initiative-title>.test.ts.
* Process: Writes the code to satisfy the plans. Runs the tests to self-verify. Writes a summary of actions to implementation-0001/log.md.
* Review Agent: agents/initiative/implement/reviewer.md
* Routing Logic:
    * If Rejected (Tests Fail / Logic Flaw): Reviewer writes revisions.md in implementation-0001/. Implementer tries again in implementation-0002/.
    * If Approved (Tests Pass): Write final-report.md. Initiative complete.
    * If Critical Unforeseen Bug Discovered: Move to Phase 3 (Issues).

---

## Phase 3: Issues (Bug Fixing Workflow)
```graph TD
classDef user fill:#f9f,stroke:#333,stroke-width:2px;
classDef agent fill:#bbf,stroke:#333,stroke-width:1px;
classDef review fill:#fdb,stroke:#333,stroke-width:1px;

UI([User Creates issue.md]):::user --> FCLAR[Fix Clarifier]:::agent
FCLAR --> HITL_FCLAR{User Confirms Issue Understanding}:::user
HITL_FCLAR -- Refines --> FCLAR
HITL_FCLAR -- Confirms --> ICG[Context Gatherer]:::agent
ICG --> FP[Fix Planner]:::agent
FP --> TW[Test Writer]:::agent
TW --> TR{Test Reviewer}:::review
TR -- Rejects --> TW
TR -- Approves --> HITL{User HITL Gate}:::user
HITL -- Rejects --> TW
HITL -- Approves --> IMP[Implementer]:::agent
IMP --> IMR{Implement Reviewer}:::review
IMR -- Rejects --> FP
IMR -- Approves --> Done([Issue Resolved])
```

### Project Initiative docs/agents/<initiative-title>/issues/ Structure
```
└╴󰝰 <initiative-title>
  └╴󰝰 issues
    ├╴󰍔 all-issues.md
    ├╴󰝰 active
    │ └╴󰝰 <issue-title>
    │   ├╴󰍔 issue.md
    │   ├╴󰍔 issue-understanding.md
    │   ├╴󰍔 context.md
    │   ├╴󰍔 fix-plan.md
    │   ├╴󰌞 issue.{spec,test,cy}.{js,jsx,ts,tsx}
    │   └╴󰝰 attempt-0001
    │     ├╴󰍔 fix-plan.md
    │     ├╴󰍔 log.md
    │     ├╴󰍔 revisions.md
    │     └╴󰌞 issue.{spec,test,cy}.{js,jsx,ts,tsx}
    └╴󰝰 fixed
      └╴󰝰 <fixed-issue>
```

### 3.1) Issue Clarification & User Confirmation
* Agent: agents/initiative/fix/clarifier.md
* Input Necessary: <issue-title>/issue.md.
* Process: Reads the user's issue description and produces a structured Issue Understanding Document with clarifying questions.
* Output: Writes to <issue-title>/issue-understanding.md.
* 🛑 HITL Gate: User reviews the understanding.
    * If Confirmed: Move to step 3.2 (Context Gathering).
    * If Refined: User provides corrections. Clarifier re-produces. Repeat until confirmed.

### 3.2) Issue Context Gathering
* Agent: agents/initiative/fix/context-gatherer.md
* Input Necessary: issue.md + confirmed issue-understanding.md.
* Action: Immediately pulls stack traces, file snippets, and relevant state based on the user's issue. Writes to context.md. (Note: Context MUST be gathered before planning a fix).

### 3.3) Fix Planning
* Agent: agents/initiative/fix/planner.md
* Input Necessary: issue.md + issue-understanding.md + context.md.
* Action: Analyzes the exact files causing the bug and generates a targeted fix-plan.md.

### 3.4) Targeted Test Writing & 🛑 HITL Gate
* Agent: agents/initiative/fix/testers/writer.md
* Process: Writes a test specifically designed to reproduce the bug and verify its fix.
* Review: Checked by test reviewer.
* HITL Validation: User must manually approve the issue test before the implementer is allowed to touch the codebase.

### 3.5) Fix Implementation & Review
* Agent: agents/initiative/fix/implementer.md
* Input Necessary: fix-plan.md + User-validated issue.test.ts.
* Process: Applies the fix. Writes to attempt-0001/log.md.
* Review Agent: agents/initiative/fix/reviewer.md
* Routing Logic:
    * If Rejected: Writes revisions.md in attempt-0001/. Planner and Implementer try again in attempt-0002/.
    * If Approved: Move issue directory from active/ to fixed/. Update all-issues.md.
