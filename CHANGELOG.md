# Changelog

## [0.1.1] — V0.1B Cocos Native Runtime

### Added
- Real Cocos `GameBootstrap` (`extends Component`, `@ccclass`, lifecycle)
- Cocos platform adapters: storage / platform / lifecycle / safe area
- Runtime Cocos UI (status, orders, 7×9 board, generator dock, toast, tutorial, level-up, debug)
- Touch drag with 12px threshold, ghost, merge highlight
- Presentation `GameViewMapper` (Chinese copy)
- `tsconfig.core.json` (pure core typecheck without `cc`)
- `tools/verify-cocos-project.mjs`, `tools/verify-all.mjs`
- `docs/COCOS_SETUP.md`, `docs/COCOS_SMOKE_TEST.md`

### Changed
- package scripts: `lint` / `lint:core`, `verify`, `verify:cocos`
- UI strings unified to Chinese
- README clarifies Cocos as primary client, browser as debug harness

### Note
- Cocos Creator was not available in this environment; Editor / Web Mobile / WeChat builds were NOT RUN here.

## [0.1.0] — V0.1 Core Merge

### Added
- Bootstrap project layout, TypeScript strict toolchain, Vitest
- Config-driven merge chains (coffee / flower / dessert / gift, 8 levels each)
- MergeEngine, board move/swap/merge rules
- Generators, energy + offline recovery, orders, progression, local save
- Browser playable client sharing the same domain layer
- Docs and AGENTS.md
