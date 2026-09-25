# File Structure Standard

## 1. Purpose
- Keep UI files small and clear for Codex collaboration and long-term maintenance.
- Prevent large files from mixing UI, state management, API calls, forms, modals, lists, and detail panels without structure.
- Provide a safe standard for splitting UI components without breaking functional logic.

## 2. File Size Guideline
- UI component: ideally under 300 lines
- Page component: ideally under 250 lines
- Feature container: ideally under 500 lines
- 500+ lines: structure review required
- 800+ lines: split/refactor plan required before UI changes

Line count is not an absolute rule. It is a risk signal that should trigger structure review before more UI work is added.

## 3. What Makes a File Risky
- A single file contains list, detail, form, and modal behavior together.
- UI is tightly mixed with API calls.
- State management and rendering are heavily mixed in one file.
- Submit, validation, mutation, or routing logic is mixed into the UI layer.
- Billing, auth, notification, booking status transitions, or other functional logic lives in the same file as presentation.

## 4. Split by Responsibility
Do not split only by line count. Split by clear responsibility boundaries.

Recommended split targets:
- page shell
- feature container
- toolbar
- list
- list item/card
- detail panel
- form
- modal/bottom sheet
- status badge
- empty state
- loading state
- presentational component
- view-model/helper

## 5. Safe Extraction Rule
1. Extract presentational components first.
2. Keep API calls in their current location.
3. Keep state management logic in its current location.
4. Keep event handlers in their current location.
5. Do not modify validation while extracting.
6. Pass the minimum props required.
7. Extract JSX structure without changing behavior.
8. Verify that existing behavior still works after extraction.

## 6. Forbidden During Extraction
The following must not be changed during component extraction:

- API changes
- DB changes
- migration changes
- auth changes
- billing changes
- notification changes
- validation changes
- routing changes
- state model changes
- data model changes
- permission/session logic changes
- payment success/failure/refund logic changes

## 7. Codex Collaboration Rule
- Analyze large files before splitting them.
- Do not split without a written analysis first.
- If there is functional risk, defer the split.
- Do not combine large-scale UI cleanup and component extraction in one pass.
- Break large-file split work into small PR-sized changes.
- After work, report touched files, deferred areas, and possible functional risk.

## 8. Recommended Refactor Order
1. Pure UI component extraction
2. Repeated visual block extraction
3. Toolbar/list/card/detail/form separation
4. View helper extraction
5. Feature container cleanup
6. Page shell cleanup last

## 9. Report Format
- File path
- Line count
- Current responsibility
- Risk reason
- Suggested split candidates
- Functional risk: Low / Medium / High
- Safe to split now: Yes / No
- Deferred reason if any
