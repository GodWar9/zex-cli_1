# Zex release plan

Priority: a reproducible developer tool to demonstrate in internship interviews.

1. Done: scoped packages, compiled library exports, declared dependencies and MIT licenses.
2. Done: remove credential-triggered fake responses; test SDK calls through test-only transport mocks.
3. Done: require API authentication, limit bodies, validate input, handle WebSocket errors.
4. Done: add no-key demo, isolated npm tarball checks and unique binary filenames.
5. Verify the full local gate and GitHub OS matrix on the final commit.
6. Requires account access: establish npm publish rights to both requested packages; publish reviewed core tarball first, then CLI.
7. Requires provider access: opt-in live provider test and interactive coding walkthrough; record a credential-free terminal demo.
8. After publication: verify fresh registry installations.

No paid hosting is needed for package distribution or the offline demo. Live model use is separate.

Next project: LSTM; Tracker follows its Redis/container gate; Finacle follows tenant isolation and live frontend integration. Tracker's docs/BUILD_PLAN.md contains the cross-project plan.
