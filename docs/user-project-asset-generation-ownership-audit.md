# User Project Asset Generation Ownership Audit

Date: 2026-05-12

Scope: repair the current authenticated user's Project -> CanvasWorkflow -> CanvasNode -> Asset -> GenerationJob chain without deleting or bulk-reassigning historical data.

Decisions:

- Project directory visibility is owner-or-member based: `Project.ownerId = currentUser.id` or an active `ProjectMember` row for `currentUser.id`.
- No bulk project owner rewrite is performed.
- Existing project owners still get an owner `ProjectMember` on project creation/ensure as a best-effort sync.
- A non-owner project is shown only when the current user already has an active `ProjectMember` relation.
- If `/create?projectId=...` or generation hits a project that is not currently visible to the user, the server may repair only that current project by creating an active `ProjectMember` when there is first-party evidence that the current user already owns an `Asset` or `GenerationJob` inside that same project. The repair writes an `AuditLog` action `project_member_attached_by_ownership_repair`.
- `/create?projectId=...` refuses projects outside the current user's owner/member access instead of silently creating an orphan canvas.
- Generation requests must include `projectId`, `nodeId`, and `prompt`; successful media persistence writes Asset ownership and CanvasNode metadata back to the same project/workflow/node.
- Historical nodes are recovered by asset id, generation job output, node/project asset linkage, metadata node ids, and old URL matches before being marked `ASSET_NOT_FOUND_BY_NODE`.
