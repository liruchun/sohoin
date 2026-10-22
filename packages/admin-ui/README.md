# Admin UI

Backend-only component entrypoints based on the MIT-licensed **shadcn/ui radix-rhea / neutral** registry, fetched 2026-10-15. This matches the component geometry observed on the official homepage on that date. Source: `https://ui.shadcn.com/r/styles/radix-rhea/{component}.json`; observations are recorded in `docs/references/shadcn-admin-observed.json`.

Button and Badge retain CVA variants and Radix Slot composition. Checkbox, RadioGroup, Switch, Sheet and AlertDialog retain Radix interactions. NativeSelect and tables stay server renderable. Card exports Header, Title, Description, Content, Footer and Action; its fieldset option preserves the settings form's legend and disabled semantics. Sidebar menu primitives compose with host route matching and responsive shell state.

Import specific entrypoints rather than a barrel. Interactive primitives and the confirmation provider own client boundaries; static tables, fields and cards can render on the server. `primitives.css` expresses the official registry rules using reusable semantic classes, with scoped standard shadcn tokens and `--au-*` compatibility aliases. `styles.css` contains the shared sidebar/inset composition. There is no Preflight reset or global utility sheet. Do not import this package from public site components.

Project-specific exceptions: neutral destructive/error colors, system fonts instead of a font download, 44px coarse-pointer hit areas, and fieldset cards. Use `useConfirmation()` inside the shell for application confirmations; it resolves to a boolean, restores focus after cancellation and never submits a write before confirmation. Browser unload prompts remain browser-owned.

No business permissions, database access or authentication logic belongs here. New dependencies still require explicit user permission.

CSS units follow the root DESIGN.md: rem for typography, spacing, control and layout sizes, ordinary radii and media-query breakpoints; unitless line-height; px for borders, focus rings, shadows and precise 1px feedback. The host keeps the root font-size at 100%. Do not convert SVG coordinates, DOM measurements, Radix collision offsets or screen-reader-only hiding rules as if they were CSS layout dimensions. The unit normalization has not been built or tested; the historical validation below predates it.

## Validation — 2026-10-15

`pnpm typecheck`, `pnpm build` and all 70 security integration checks passed. Desktop (1440px) and mobile (390px) settings screenshots and DOM checks confirmed the rounded controls, filled fields, card hierarchy and lack of horizontal overflow. The browser interaction check confirmed AlertDialog cancellation issues no session-revocation request, returns focus to its trigger, and preserves unsaved form values when navigation is cancelled. The browser-owned reload prompt remains active for unsaved changes.

Production comparison with `scripts/measure-pages.mjs` uses the same database and empty Logo settings. Homepage HTML/CSS sizes and JS/CSS request counts are unchanged; gzip JS differs by 119 B in the rebuilt shared bundles, with no admin or Radix modules in its client-reference manifest. On settings, gzip HTML increases 399 B, gzip JS 5,109 B and gzip CSS 1,374 B; JS requests change from 12 to 13 while CSS stays at 2. Content management adds 871 B gzip HTML and 12,265 B gzip JS, with 12→14 JS requests, reflecting semantic table slots and the shared confirmation/selection primitives. Reports: `.local/performance/shadcn-before.json` and `shadcn-after.json` (ignored local artifacts). These are local transfer-size estimates, not production-network timings.
