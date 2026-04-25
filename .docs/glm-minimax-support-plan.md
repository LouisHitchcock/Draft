# GLM and MiniMax support plan

## Goal

Add a concrete, low-risk path for supporting:

- Z.AI GLM Coding Plan sessions in Draft
- MiniMax coding-plan sessions in Draft

The key constraint is billing and quota semantics, not just model compatibility. Draft needs to use a supported coding tool runtime so these products behave like their vendor docs describe.

## Status update

The generic `opencode` provider described in this plan is now implemented in Draft.

Current shipped state:

- Draft exposes `OpenCode` as a first-class provider in the picker and server contracts.
- The server runs `opencode acp` through `apps/server/src/opencodeAcpManager.ts`.
- OpenCode model lists flow back into Draft through ACP `session.configured` events, and Draft also ships a built-in `Default` sentinel under OpenCode so the first session can start without guessing a vendor-specific `provider/model` id.
- `approval-required` runtime mode currently maps to OpenCode permission prompts for `edit` and `bash` through `OPENCODE_CONFIG_CONTENT`.
- Authentication still stays outside Draft through `opencode auth login`, while Draft now inspects resolved OpenCode config/auth/MCP state in `server.getConfig` so the app can show credential and MCP health without storing those credentials itself.

## What the upstream docs imply

### Z.AI GLM Coding Plan

- The plan is only usable inside supported coding tools.
- Direct API calls do not consume Coding Plan quota.
- Supported tools include Claude Code, Roo Code, Kilo Code, Cline, OpenCode, Crush, Goose, and OpenClaw.
- The Claude Code guide uses Anthropic-style environment variables, with `ANTHROPIC_BASE_URL` pointed at Z.AI and default Claude model mappings redirected to GLM models.
- The OpenCode guide routes users through `opencode auth login`, with a distinct `Z.AI Coding Plan` provider choice.

### MiniMax coding tools

- MiniMax documents Claude Code as the recommended end-user setup.
- MiniMax also documents OpenCode, Cline, Roo Code, Kilo Code, Codex CLI, and others.
- MiniMax explicitly marks Codex CLI as not recommended and pins it to an older version because of compatibility issues.
- MiniMax's Anthropic-compat docs and its M2.7 coding-tools guide are not fully aligned: the coding-tools page configures `MiniMax-M2.7` through Anthropic-style Claude Code settings, while the Anthropic compatibility page still claims only older MiniMax model families are supported. Draft should treat that as an upstream documentation conflict and avoid making the Anthropic-compat path the first implementation target for MiniMax.

### OpenCode runtime surface

- OpenCode exposes `opencode acp`, an ACP server over stdio using JSON-RPC / nd-JSON.
- OpenCode also has a JS/TS SDK and a server mode, but ACP is the cleanest fit for Draft's existing provider architecture.
- OpenCode credentials live in `~/.local/share/opencode/auth.json` when users authenticate through `opencode auth login`.
- OpenCode supports config overrides through `OPENCODE_CONFIG`, `OPENCODE_CONFIG_DIR`, and `OPENCODE_CONFIG_CONTENT`, which means Draft can add per-session runtime overrides without mutating the user's global config.

## Runtime decision

### Reject as the primary path: direct API adapters

Do not add direct Z.AI or MiniMax API adapters in Draft for the first pass.

Reasons:

- Z.AI states that Coding Plan quota only applies inside supported coding tools.
- A direct Draft API adapter would bypass the supported-tool requirement and turn GLM usage into ordinary API billing.
- MiniMax's direct API path is usable in general, but it does not solve the Z.AI quota constraint, so it does not give Draft one shared implementation path.

### Reject as the primary path: Codex reuse

Do not try to support these plans by reusing Draft's existing Codex runtime.

Reasons:

- Z.AI does not document Codex as a supported Coding Plan tool.
- MiniMax documents Codex CLI as not recommended and version-sensitive.
- Reusing Codex would still not solve the Z.AI tool-only quota requirement.

### Viable but defer: Claude Code provider

Claude Code is a real option, and both Z.AI and MiniMax document it.

However, it is not the best first target for Draft because:

- Draft currently has no Claude runtime implementation, only a picker placeholder.
- Claude Code does not give Draft the same clean ACP/app-server integration surface that Copilot, Kimi, and OpenCode do.
- A Claude-first integration would require a new runtime driver based on `claude -p`, `stream-json`, or the Claude Agent SDK instead of reusing Draft's existing ACP patterns.

Claude Code should stay on the roadmap, but it should be a follow-up provider project, not the first implementation used to unlock GLM and MiniMax support.

### Primary recommendation: OpenCode ACP

Implement GLM and MiniMax support on top of a new `opencode` provider in Draft.

Reasons:

- Both Z.AI and MiniMax document OpenCode.
- OpenCode has an ACP server that matches Draft's current Copilot and Kimi integration family.
- OpenCode already supports provider auth and model selection for Z.AI and MiniMax in its own docs.
- OpenCode config can be overridden per session, which gives Draft a clean path for runtime-mode mapping and future provider-specific presets.

## Product shape

### Phase 1 product surface

Ship a generic `OpenCode` provider first.

Rationale:

- It keeps the server contract honest: the runtime is OpenCode, not Z.AI or MiniMax directly.
- It avoids guessing vendor-specific provider ids before Draft has validated a real OpenCode session end to end.
- It unlocks both GLM and MiniMax as soon as the user has authenticated OpenCode for those providers.

In practice, phase 1 support means:

- Users install OpenCode and authenticate it outside Draft with `opencode auth login`.
- Users select `Z.AI Coding Plan` or `MiniMax` during that auth flow, exactly as the vendor docs describe.
- Draft starts `opencode acp` sessions and consumes the model list OpenCode exposes.

### Phase 2 UX polish

After the generic OpenCode runtime is stable, Draft can decide whether to add picker aliases such as `GLM Coding Plan` and `MiniMax` that both map to the `opencode` runtime.

Do not do this in phase 1.

Rationale:

- It is a UI polish decision, not a runtime requirement.
- It depends on confirmed provider ids and model naming conventions from live OpenCode sessions.
- It is easier to add once the underlying runtime is already tested.

## Implementation phases

### Phase 0: shared ACP cleanup

Before adding a third ACP-backed CLI, extract the common ACP session lifecycle from the existing managers.

Current evidence:

- `apps/server/src/copilotAcpManager.ts`
- `apps/server/src/kimiAcpManager.ts`

Both managers duplicate the same broad responsibilities:

- spawning a child process
- establishing an ACP connection
- translating ACP tool calls and approvals into Draft runtime events
- resuming sessions and forwarding turn lifecycle events

Planned work:

- extract a shared ACP CLI runtime helper under `apps/server/src/provider` or a nearby server-local module
- keep provider-specific argument/env/config logic small and isolated
- avoid adding `opencode` as a third copy-pasted ACP manager

### Phase 1: add `opencode` as a provider kind

Planned file targets:

- `packages/contracts/src/orchestration.ts`
- `packages/shared/src/model.ts`
- `apps/server/src/provider/Layers/ProviderService.ts`
- `apps/server/src/serverLayers.ts`
- `apps/web/src/session-logic.ts`
- `apps/web/src/components/chat/ProviderModelPicker.tsx`

Planned behavior:

- add `opencode` to the provider kind contract
- register an `OpenCodeAdapter` on the server
- expose `OpenCode` in the web picker as an actual provider, not a placeholder
- add an OpenCode icon mapping and model list handling in the web app

### Phase 2: implement `OpenCodeAcpManager`

Planned server file:

- `apps/server/src/opencodeAcpManager.ts`

Startup strategy:

- spawn `opencode acp`
- pass the current workspace `cwd`
- use runtime-specific env overrides rather than editing the user's global OpenCode config

Important runtime overrides Draft should own:

- `OPENCODE_CONFIG_CONTENT` for per-session config
- provider-independent permission settings that map Draft runtime modes to OpenCode permissions

Runtime-mode mapping:

- `full-access` -> OpenCode permissions stay fully allowed
- `approval-required` -> Draft injects an OpenCode permission config that requires approval for edit and bash operations

Do not require Draft to write `~/.config/opencode/opencode.json`.

### Phase 3: authentication and onboarding

For the first implementation, keep authentication outside Draft.

Planned behavior:

- Draft only needs an OpenCode binary-path override in settings for phase 1
- onboarding copy should tell users to run `opencode auth login` first
- GLM users select `Z.AI Coding Plan` in OpenCode's auth flow
- MiniMax users select `MiniMax` in OpenCode's auth flow

Why this is the right first cut:

- OpenCode already stores credentials in its own auth file
- Draft does not need to guess provider ids or duplicate OpenCode's credential UX on day one
- it reduces the amount of secret-storage work needed before shipping usable support

### Phase 4: optional Draft-managed provider presets

Only after phase 3 works, add Draft-managed startup presets.

These presets can use `OPENCODE_CONFIG_CONTENT` so Draft can override session config without mutating global files.

Examples of future preset work:

- constrain the visible provider/model set for a GLM-focused session
- add default runtime-mode permissions
- pin a default model per preset
- inject custom provider config for vendors that need explicit `baseURL` or model metadata

This phase is especially relevant if Draft later wants top-level `GLM Coding Plan` and `MiniMax` picker entries instead of one generic `OpenCode` entry.

## Testing plan

### Server/runtime tests

Add tests that mirror the current ACP-backed provider coverage.

Targets:

- manager argument/env generation
- runtime-mode permission mapping
- model-list propagation from ACP to Draft
- approval flow translation
- resume cursor handling

Do not make tests depend on a live OpenCode install.

Use a mock ACP subprocess or a minimal test harness, the same way Draft already isolates provider runtime behavior in tests.

### Web tests

Add coverage for:

- provider picker availability
- model picker behavior for OpenCode models
- settings persistence for the OpenCode binary override

### Verification commands

Before the work is considered complete, the repo-standard verification loop still applies:

- `bun run fmt`
- `bun run lint`
- `bun run typecheck`
- `bun run test`

## Documentation updates that should ship with the code

When the implementation starts, update these docs together with the code:

- `README.md`
- `.docs/provider-architecture.md`
- `.docs/provider-settings.md`
- `AGENTS.md`

Docs need to be explicit that phase-1 GLM/MiniMax support runs through OpenCode, not through direct vendor-specific Draft adapters.

## Open questions to resolve during implementation

1. Which OpenCode provider ids are exposed for `Z.AI`, `Z.AI Coding Plan`, and `MiniMax` in a live authenticated session?
2. Does OpenCode's ACP surface expose all model metadata Draft needs for reasoning and model-picker presentation, or will Draft need small local overrides?
3. Which OpenCode permission settings best match Draft's `supervised` mode without making approvals too noisy?
4. Should Draft expose a generic `OpenCode` provider permanently, or only use it as the backing runtime for future GLM/MiniMax picker aliases?

These are implementation-time questions, not blockers for the architectural decision.

## Acceptance criteria

The plan is satisfied when Draft can do all of the following:

- launch OpenCode through ACP from a Draft session
- show OpenCode-exposed models in Draft's picker
- run a session with a user-authenticated Z.AI Coding Plan account through OpenCode
- run a session with a user-authenticated MiniMax account through OpenCode
- preserve Draft runtime-mode behavior with sensible permission mapping
- pass `bun run fmt`, `bun run lint`, `bun run typecheck`, and `bun run test`

## Follow-up project: Claude Code provider

Once OpenCode support exists, Draft can separately decide whether to activate the existing Claude Code placeholder.

That should be tracked as a different project with a different goal:

- expose a first-class Claude runtime in Draft
- support the vendor-recommended Claude Code setup path for users who specifically want Claude Code

It should not block the first working GLM and MiniMax support path.
