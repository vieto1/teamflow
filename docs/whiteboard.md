# Exit Whiteboard

Integrated editor: @excalidraw/excalidraw 0.18.1, MIT license, https://github.com/excalidraw/excalidraw.

Board picker, searchable titles, shared infinite canvas, frame list, text search, notes, simple planning template, native shapes/arrows/freehand/images, collaborators and live cursors, fullscreen, viewing mode, Excalidraw JSON import/export and PNG export.

Persistence: exit_boards, exit_board_elements, exit_board_assets in the existing Supabase project. exit_merge_board atomically merges each element using its version and lower versionNonce on ties, matching Excalidraw reconciliation. Deleted elements persist as tombstones. Pending elements and images are backed up locally and retried every 1.5 seconds; opening another board waits for a save. Tab closing shows an unsaved-change warning. Realtime broadcasts are supplemented by a 12-second snapshot reconciliation after missed messages.

Access matches the existing public loginless team workspace. Board content is not private to named members; participant names are display names, not authentication. No secret database credentials are bundled. RLS is enabled with explicit public workspace policies for anon. Introduce authenticated workspace membership before using confidential material.

There is no application limit on frames. Practical browser memory, Supabase storage/realtime quotas and performance limits apply. Individual shared images are limited to about 3 MB. Export before deleting a board. Remote editor updates do not enter the local undo history.

This is not full Miro parity: no Miro AI, workshop voting/timers, threaded comments, enterprise permissions, PDF rendering/export, third-party integrations or server-side version history. Existing document board and meeting features remain separate.

Verification: npm run build; npx tsc --noEmit; node tests/board-integration.mjs (two real Supabase clients: distinct element writes, stale update protection, tombstones, deterministic tie, cross-client broadcast; removes its own temporary board).
