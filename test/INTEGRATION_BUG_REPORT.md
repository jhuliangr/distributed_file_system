# Integration Bug Report

- Date: 2026-06-23
- Scope: End-to-end integration for client + naming server + storage servers
- Environment: local in-process test stack (`node --test`), naming DB `:memory:`, 3 storage nodes
- Owners: Jhulian (naming), Mayda (storage), Alberto (client)

## Test Matrix Executed

- Create -> read -> content identical
- Create -> delete -> verify file no longer exists
- Create -> size -> verify exact value
- Bring down one storage server -> verify read succeeds via replicas
- Multi-chunk file (>1KB) -> verify correct reassembly
- Replication check -> verify each chunk exists on >=2 storage servers
- Test-data fixtures verified: `<1KB` (513B), `=1KB` (1024B), `several KB` (3584B)

## Findings

No functional bugs found in this test run.

## Evidence

- Test suite: `npm test`
- Result: 25 passed, 0 failed
- Relevant suite: `test/e2e.integration.test.ts`

## Notes

- One environment issue was observed before dependency install: missing `express` package locally caused module load failure for naming-server tests. This is not a product bug and was resolved by running `npm install`.

## Status

- Overall status: clear for covered scenarios
- Follow-up: continue running this suite in CI on every merge
