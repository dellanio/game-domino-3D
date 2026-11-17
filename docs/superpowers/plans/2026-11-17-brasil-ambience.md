# Brasil square ambience implementation plan

**Goal:** Add the approved Portuguese pavement, monobloc chairs, boteco details, afternoon sun and urban vegetation to the Brasil theme.

**Architecture:** Keep the existing Three.js stage and procedural assets. Split decorative groups into helpers with explicit exports, integrate after their independent review gates, and dispose them through the existing stage traversal.

**Tech stack:** TypeScript, Three.js, Vite, Vitest. No additional dependencies or paid assets.

**Approved design:** The user authorized the full pipeline for the three parts proposed in the planner. Use a restrained Brazilian square composition: black/white wave mosaics, worn white plastic chairs (one casual angle), red coaster and American beer glass with foam, metallic snack plate, sparse bottle caps, plaster wall and tropical foliage, warm long shadows. Preserve the gray cement table with thick borders, blue tiles with white pips, music, rules, modes, Default and existing interface. No postprocessing blur over the game.

## Global constraints

- Integrate into `feature/brasil-ambience`, based on `main` at d9b937b. Publish only after visual verification.
- Table playing surface remains y=0, width=30, depth=22. Floor y=-3.45. Never cover hands, boneyard or chain.
- Decorations must remain outside x=[-15,15], z=[-11,11], except small edge props on the outer rim x or z beyond that rectangle.
- Avoid extra render loops, listeners or shared mutable texture sources. Geometry/material/texture ownership must fit Stage.dispose.
- Use bounded procedural geometry and cached materials, no external downloads or paid generation.

## Review focus

- Changing Brasil to Default and back must restore the original scene without accumulating objects or lights.
- Props and shadows must not obscure hands, boneyard, tile choices or HUD across OrbitControls angles.
- Pavement images must not share mutable texture sources with tabletop concrete.
- Instanced foliage/chairs must have bounded draw calls and memory suitable for mobile.
- Warm lighting must preserve deep blue tile bodies and readable white pips.

## Task 1: Pavement and afternoon light

Files: `src/render/brasilStage.ts`, optional `src/render/brasilPavement.ts`, `tests/brasilPavement.test.ts`.

- [ ] Implement deterministic small stone mosaics with black/white wave bands, subtle aggregate and mortar relief. Keep table maps independent.
- [ ] Set low warm afternoon sun with long soft shadows, adequate frustum, neutral fill for tile readability. No Default changes.
- [ ] Verify local generation, surface and resource ownership; npm test and npm run build. Review and merge into target.

## Task 2: Chairs and boteco props

Files: create `src/render/brasilProps.ts`, `tests/brasilProps.test.ts`. Do not modify stage or game.

Produces `buildBrasilProps(width: number, depth: number): THREE.Group`.

- [ ] Build recognizable lightweight monobloc chairs: white sun-worn molded seat/back, open back slots and four legs, one at casual angle. Seats above floor and below table.
- [ ] Add a red coaster, American beer glass with faceted sides, amber liquid and foam/condensation, metallic plate with bite-sized food, a few caps. Keep all placements outside play rectangle.
- [ ] Geometry must be plausible at default camera; no oversized garnish or scattered clutter.
- [ ] Test finite transforms, bounds outside play rectangle and bounded node count; npm test/build. Review and merge helper without integration.

## Task 3: Background and final integration

Files: create `src/render/brasilBackground.ts`, `tests/brasilBackground.test.ts`; modify `src/render/brasilStage.ts` and README.

Produces `buildBrasilBackground(width: number, depth: number): THREE.Group` independently. The pilot integrates this and `buildBrasilProps(width, depth)` after all three technical review gates, keeping source ownership separate.

- [ ] Add textured plaster perimeter walls and one or two stylized tropical trees using restrained muted foliage, trunk and branch shapes with coherent scale. Keep clear views to table.
- [ ] Integrate both decorative helpers into Brasil group. No depth-of-field dependency. Fit background into current fog and shadows.
- [ ] Verify geometry transforms, theme lifecycle, no repeated allocations, npm test/build.
- [ ] Review and merge. Pilot checks browser at desktop/mobile and alternate angles; complete a game interaction and theme round trip before main merge/push.
