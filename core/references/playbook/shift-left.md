# Shift-Left and Communication
<!-- qab: scope=test-plan,review-ticket,start -->

Testing starts from communication. The earliest and most cost-effective testing
is verifying alignment before code is written.

## Principles
<!-- qab: id=principles -->

- **Verify alignment.** Ensure everyone is on the same page about what the client
  requires and what the team is building.
- **Challenge requirements.** Look at alternative solutions or approaches that solve
  the client's need without unnecessary development effort.
- **Identify missed requirements.** Cross-reference with existing features to find
  gaps, conflicts, or redundancies.
- **Force detailed discussion.** Asking precise questions about edge cases, error
  handling, and user workflows naturally tests the team's understanding.

## How Claude Applies This
<!-- qab: id=application -->

When reviewing tickets (`/qa-review-ticket`):
- Cross-reference the ticket with the test knowledge base and existing Jira context
  to verify alignment with original intent.
- Challenge the SDT with questions about alternative solutions or missed requirements.
- Identify inconsistencies between the ticket and related epics, PRDs, or design docs.

When building test plans (`/qa-test-plan`):
- Verify the epic requirements trace back to the original client need.
- Flag any requirements that seem to have drifted from the original intent.

