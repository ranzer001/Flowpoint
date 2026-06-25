# MASTER BUILD PROMPT — Payment Streaming Vault (Stellar Soroban dApp)

Copy everything below this line into a fresh coding agent session (Claude Code, Antigravity, etc.) as a single prompt.

---

## ROLE & GOAL

You are building a **complete, production-grade, fully working Stellar Soroban dApp** called **Payment Streaming Vault**. This is for a hackathon-style challenge that is graded against a strict checklist. Treat every requirement below as **mandatory and individually verifiable** — not aspirational. Do not skip, fake, simulate, or stub anything. If something cannot be completed for real, stop and report it instead of inventing a placeholder.

**Concept:** A user creates a "stream" — locking XLM (or a custom token) that vests linearly to a recipient over a chosen duration. The recipient can withdraw whatever has vested so far at any time, and watches a live counter tick upward in real time as funds vest. Funds release via an on-chain inter-contract call from the Stream contract to the Token contract — this inter-contract call is the centerpiece technical feature and must be real and provable.

---

## HARD RULES (violating any of these is a failure of the task)

1. **Never fabricate a transaction hash, contract address, or account ID.** Every hash/address that ends up in the README MUST come from an actual command you ran against Stellar testnet. A real Stellar transaction hash is exactly 64 lowercase hex characters (`0-9a-f` only). Before writing any hash into the README, validate it against that pattern. If you don't have a real one yet, write `PENDING — generate after deployment`, never a placeholder-looking string.
2. **Never claim a screenshot exists if you didn't generate/capture it.** If you cannot capture a literal screenshot (e.g., of a running CI pipeline), say so explicitly in the README with instructions for the human to capture it, rather than describing a fake one.
3. **Every checklist item below must have a corresponding, explicitly labeled section in the README** — use the exact item wording as a heading or sub-heading so it's trivially matchable during review.
4. **The inter-contract call must be real Soroban-to-Soroban contract invocation** (`env.invoke_contract` or the SDK equivalent) — not a faked "simulated" call, not two independent contracts that never actually call each other.
5. **Build incrementally with meaningful, separate git commits** (minimum 12) reflecting real progressive stages — not one giant commit. See the commit plan near the end of this document.
6. **Test output, CI runs, and deployments must all be real and actually executed by you during this build**, not narrated as if they happened.

---

## TECH STACK

- **Smart contracts:** Rust + Soroban SDK (latest stable version — check `soroban-sdk` crate version at build time, don't assume an old one)
- **Frontend:** Next.js 14 (App Router) + TypeScript
- **Wallet integration:** `@creit.tech/stellar-wallets-kit` (StellarWalletsKit) so multiple wallets are supported, not just Freighter — but Freighter must work as the primary tested path
- **Data fetching / polling:** SWR
- **Styling:** Plain CSS or Tailwind (your choice) — see DESIGN section for required visual direction
- **Animation (optional, tasteful):** Framer Motion, used sparingly
- **Deployment:** Vercel or Netlify for frontend; Stellar testnet for contracts
- **CI/CD:** GitHub Actions

---

## SMART CONTRACT ARCHITECTURE

### Contract 1: `token` (or use an existing Soroban Asset Contract / SAC wrapper for native XLM if simpler)
- Standard fungible token interface: `balance`, `transfer`, `mint` (testnet only), `approve` if needed
- If using native XLM via the Stellar Asset Contract wrapper, document that decision instead of writing a redundant token contract — simpler is fine as long as the inter-contract call below is still real

### Contract 2: `stream` — the core logic
Functions required:
- `create_stream(sender: Address, recipient: Address, deposit: i128, duration_seconds: u64) -> u64` — locks `deposit` amount (calls Token contract to transfer funds from sender into the Stream contract's custody), stores stream struct (sender, recipient, deposit, start_time, duration, withdrawn), returns a stream ID
- `vested_amount(stream_id: u64) -> i128` — pure read function: `deposit * min(elapsed, duration) / duration`
- `withdraw(stream_id: u64) -> i128` — computes vested amount minus already-withdrawn, **calls the Token contract via inter-contract invocation** to transfer the withdrawable amount to the recipient, updates `withdrawn`, emits an event, returns amount withdrawn
- `cancel_stream(stream_id: u64)` (optional but recommended) — sender can cancel, vested portion goes to recipient, remainder returns to sender (also an inter-contract call)
- `get_stream(stream_id: u64) -> Stream` — read full struct
- `list_streams_for(address: Address) -> Vec<u64>` — for the UI to find a user's streams

**Events to emit** (Soroban `env.events().publish`): `stream_created`, `withdrawal`, `stream_cancelled`. The frontend must listen for/poll these for real-time updates — this satisfies the "event streaming & real-time updates" requirement.

**The inter-contract call requirement:** `withdraw` and `create_stream` in the `stream` contract MUST call functions on the `token` contract using `env.invoke_contract::<ReturnType>(&token_contract_id, &symbol_short!("transfer"), vec![...])` (or the typed client equivalent). Name this mechanism explicitly in code comments and later in the README.

### Testing (mandatory, real, must actually pass)
Write **at least 5** Rust unit tests in the `stream` contract crate, executed with `cargo test` / `stellar contract build` test runner:
1. `create_stream` succeeds and locks correct deposit amount
2. `vested_amount` returns 0 at `t=0`, ~50% at `t=duration/2`, 100% at `t>=duration`
3. `withdraw` correctly transfers only the vested-and-not-yet-withdrawn amount, and that it actually invokes the token contract (assert balance change post-call)
4. `withdraw` fails gracefully if called by a non-recipient address
5. `create_stream` fails if deposit is 0 or duration is 0 (input validation)

Capture the real terminal output of a full passing test run — this text goes into the README and is also the source for the required test-output screenshot.

---

## FRONTEND REQUIREMENTS

### Wallet flow
- Connect / disconnect via StellarWalletsKit (must support at least Freighter; offering more is a bonus)
- Display connected address (truncated) and live XLM balance, refreshed via SWR polling (every 5–10s) and after every transaction

### Core UI screens/components
1. **Create Stream form** — recipient address input, amount input, duration picker (e.g., minutes/hours for testnet demo purposes so vesting is visibly fast), submit button that builds + signs + submits the `create_stream` transaction
2. **My Streams dashboard** — list of streams where the user is sender or recipient, each showing:
   - A **live numeric ticker** for vested amount that visibly increments — implement this by computing `vested_amount` client-side from `start_time`/`duration`/`deposit` (no need to hit the chain every frame) and re-syncing against the actual contract value every poll cycle, so the number is both smooth AND ultimately accurate
   - A progress bar reflecting % vested
   - A **Withdraw** button (recipient only), disabled with a clear reason when not applicable
3. **Transaction feedback** — every transaction (create/withdraw/cancel) must show: pending state, then success (with tx hash + link to Stellar Expert) or failure (with human-readable reason), never a silent failure
4. **Activity feed** — recent events (created/withdrawn/cancelled) across the user's streams, updating without a full page reload

### Required error handling — at least these 3 distinct, clearly differentiated states:
1. **Wallet not installed / not found** — detect and show an actionable message ("Install Freighter" with link)
2. **User rejected the signature request** — distinguish this from a real failure, show a calm "transaction cancelled" message, not a scary error
3. **Insufficient balance** — pre-validate before submitting and/or catch the contract error and explain it in plain language

### Mobile responsiveness
- Test and ship a genuinely responsive layout at ~375px width (iPhone SE) and ~768px (tablet) — not just a desktop layout that doesn't break, an intentionally adapted one (e.g., stacked cards instead of a table, bottom-fixed primary action button on mobile)

---

## DESIGN DIRECTION (read before writing any CSS)

Do **not** default to a generic dark-glassmorphism crypto-dashboard look (purple/blue gradient glass cards, neon accents) — this is the most overused aesthetic in Stellar hackathon submissions and will make the project look templated. Instead:

- Pick one distinctive, intentional visual identity (e.g., a warm editorial/paper-and-ink look, a clean Swiss/grid-based fintech look, or a bold single-accent-color minimal look) and apply it consistently
- Use real typographic hierarchy (a distinct display font for numbers/headers is encouraged — the live vesting ticker is the hero moment of the UI, design around it)
- Motion should support meaning (e.g., the ticker counting up, a progress bar filling) — avoid decorative animation for its own sake
- Consult any available frontend design skill/guidance in your environment before finalizing styling decisions

---

## CI/CD PIPELINE

Create a GitHub Actions workflow (`.github/workflows/ci.yml`) that runs on every push/PR to main and does, as real separate jobs/steps:
1. **Contracts job:** install Rust + the `wasm32-unknown-unknown` target, run `cargo test` for the `stream` contract, build the optimized WASM
2. **Frontend job:** install Node deps, run lint, run `npm run build`
3. Badge for this workflow goes at the top of the README, and it must reflect a real passing run — push and let it actually execute before writing it up

---

## DEPLOYMENT WORKFLOW (must be executed for real)

1. Generate/fund a deployer testnet account via Friendbot
2. Build and deploy the `token` contract (or configure the SAC wrapper) to testnet — record the real contract address
3. Build and deploy the `stream` contract to testnet, configured with the token contract's address — record the real contract address
4. From the deployer or a second funded test account, actually call `create_stream`, wait, then call `withdraw` — capture the **real transaction hashes** for both
5. Verify both contract addresses and both transaction hashes resolve on `https://stellar.expert/explorer/testnet/...` before putting them in the README
6. Deploy the frontend to Vercel or Netlify and get a real live URL; wire the deployed contract addresses into its environment config

---

## README STRUCTURE (mirror this exactly, heading-for-heading)

```
# Payment Streaming Vault

[CI/CD badge] [Stellar Testnet badge] [License badge]

Live Demo: <real url>
Demo Video (1–2 min): <real url — record after the app fully works>

## Project Description
## Architecture (with a diagram: Stream contract <-> Token contract <-> Frontend <-> Wallet)
## Tech Stack
## Smart Contracts (Testnet)
| Contract | Address | Stellar Expert Link |
## Inter-Contract Calls
  - Explain exactly which functions call which, and how (name the SDK call used)
  - Transaction Hash Evidence: <real hash> (View on Stellar Expert: <real link>)
## Wallet Connection (Connect / Disconnect)
## Balance & Streaming Mechanics
## Error Handling (list the 3+ handled error types explicitly)
## Screenshots
  - Wallet connected state
  - Stream creation flow
  - Live vesting ticker / dashboard
  - Successful withdrawal + transaction confirmation
  - Mobile responsive UI
  - CI/CD pipeline run (actual screenshot of the Actions tab, green check)
  - Test output (actual terminal output, 5+ passing tests)
## Setup Instructions (clone, install, env vars, run locally, deploy contracts)
## Testing (how to run `cargo test`, paste real output)
## Commit History Summary (brief note that the project was built incrementally — link to commits)
## License
```

---

## COMMIT PLAN (minimum 12 commits, real and incremental — do not squash)

1. `chore: project scaffold (Next.js + Soroban workspace)`
2. `feat: token contract implementation`
3. `feat: stream contract — create_stream and storage model`
4. `feat: stream contract — vested_amount calculation`
5. `feat: stream contract — withdraw with inter-contract token transfer`
6. `feat: stream contract — cancel_stream`
7. `test: stream contract unit tests (5+ passing)`
8. `feat: wallet connect/disconnect via StellarWalletsKit`
9. `feat: create stream UI flow`
10. `feat: live vesting ticker + dashboard + withdraw UI`
11. `feat: error handling (wallet missing, rejected signature, insufficient balance)`
12. `feat: mobile responsive layout`
13. `ci: GitHub Actions pipeline for contracts + frontend`
14. `chore: testnet deployment + real contract addresses wired in`
15. `docs: README with full evidence (addresses, tx hashes, screenshots)`

---

## FINAL VERIFICATION CHECKLIST — confirm every line is literally true before declaring done

- [ ] Both contracts actually deployed on testnet, addresses verified on Stellar Expert
- [ ] At least one real `create_stream` and one real `withdraw` transaction executed, both hashes verified on Stellar Expert
- [ ] `withdraw` provably calls the token contract (visible in code + reflected in the real transaction's effects)
- [ ] 5+ contract tests written and actually passing, output captured
- [ ] CI workflow actually ran and passed, screenshot captured from the real Actions tab
- [ ] Wallet connect, disconnect, balance display, and 3 distinct error states all manually verified working
- [ ] Mobile layout manually checked at ~375px
- [ ] Live demo URL is real, loads, and matches what's in the README (no mismatched/stale URLs)
- [ ] No placeholder/fake hashes, addresses, or screenshots anywhere in the repo
- [ ] 12+ real, incremental commits in git history

Begin building now. Work through the contract layer first, verify it with real tests and a real testnet deployment, then build the frontend against the real deployed addresses, then finish with CI/CD and the README.
