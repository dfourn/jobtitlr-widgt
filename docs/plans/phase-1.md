# Phase 1 plan: jobtitlr core (`feat/jobtitlr-core`)

| | |
|---|---|
| Status | In effect (D1: a delta against `guide-jobtitlr.md`, which carries the research; no questions, so no approval stop) |
| Branch | `feat/jobtitlr-core`, from `main` at `b58cea9` |
| Guides | [`guide-jobtitlr.md`](guide-jobtitlr.md) §2–§8; master plan §6 and §3 |

## Delta against the guide

1. **Sequencing.** The master plan starts Phase 1 after H1. H0 (Dan's relock) had not happened when Dan asked
   for unattended overnight progress, so this branch was cut from `main` early. Phase 1 touches no widgt file,
   so the relock cannot affect it. H2 (spec 01 acceptance, merge approval) is unchanged and still Dan's.
2. **Work packages** (one implementer subagent at a time, per master plan §4):
   - 1.1 guide §2 (spec 01 + ASSUMPTIONS edits, one `docs(jobtitlr)` commit; status stays Draft)
   - 1.2 guide §3 (scaffold; `./mvnw -q verify` exit 0; `mvnw` mode 100755)
   - 1.3 guide §5 cycles C1–C7; 1.4 cycles C8–C14; 1.5 C15–C16 + guide §6 NFR-4 check
   - 1.6a guide §8 ADR 0002 (doc writer, may overlap 1.3–1.5; orchestrator commits)
   - 1.6b guide §7 `jobtitlr/README.md` (after 1.5: needs the final test count)
3. **Pre-authorised fallback** (guide §3): if Surefire rejects the phrased-name reporter block, drop the block,
   note it here, carry on.
4. **Exit** (master plan §6): fresh-clone `./mvnw -q verify` and `./mvnw -q compile exec:java` exit 0 with the
   four demo lines; NFR-4 ID diff exits 0 (38 IDs); reviewer subagent findings fixed; AI-USAGE and private
   notes updated; then **H2** — stop for Dan.

## Decisions already made (do not re-open)

D4 (all nine spec edits), D2/D3 (merge approval; `Assisted-by:` trailer), master plan §3 rules, and the guide's
§4 API, algorithm, exception messages and worked values are final. An implementer follows them literally.
