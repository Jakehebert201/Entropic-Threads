## Entropic Threads

Entropic Threads is an incremental game powered by TypeScript + Vite and driven by `break_eternity.js` big numbers. Explore cascading production chains, reset layers, and braiding-based multipliers.

### Play Now
- **Live build:** https://ilovegreattits.com/game/

### Quick Controls
- Click **Buy 1** next to any generator to pick up a single unit.
- Use **Buy Max All** (button or `M` key) to purchase the best bundle your strings allow.
- The **Save Now** button in Settings writes immediately; autosaves run on the configured interval and when closing the tab.
- Import/Export lives in Settings → Saving for clipboard backups or slot transfers.

### Design Pillars
- **Compound hierarchies:** every generator tier feeds the one below it, creating cascading growth.
- **Meaningful resets:** braiding and future layers wipe progress but grant permanent, multiplicative advantages.
- **Readable exponential math:** big numbers stay legible through consistent formatting and snapshot stats.
- **Respect player time:** autosaves, offline progress, and minimal waiting between unlocks keep the loop snappy.
- **UI clarity:** settings, stats, and build info surface critical context without leaving the play screen.

### Braiding Math
You unlock the braiding panel after your run reaches 1e12 strings, and once revealed it stays available permanently for that save. The 12 generators are split into four alternating chains (Gen1/5/9, Gen2/6/10, Gen3/7/11, Gen4/8/12). Hitting the **Braid Reset** button wipes your strings and generators, but it banks the highest string total from that run and turns it into a gentle multiplier that applies to every generator inside each chain.

```ts
const log = Math.log10(Math.max(1, totalStrings));
const exponent = Math.pow(log, 0.85) / 5;
const chainMultiplier = 1.02 ** exponent;
```

Only the generators that belong to a given chain receive the bonus, but the multiplier persists forever and grows with your best strings on reset.
### ROADMAP
 **Layer Outline**

1. **Base Layer – Generators**  
   Core Loop: Buy generators → produce Strings → buy higher tiers.  
   Mechanics:  
   - Each generator multiplies output of the previous one.  
   - Costs grow exponentially (`base_cost × 1.15^bought`).  
   - Unlock Braiding once total strings ≥ ~e64 – e128.

2. **Braiding**  
   Concept: Combine multiple strings into Braids to create permanent production multipliers.  
   Mechanics:  
   - Resets strings and generators.  
   - Each braid adds a Braid Multiplier (`1.15^(braids)` or similar).  
   - Unlocks faster exponential growth, shortens early progression.  
   Goal: Reach around `2^1024` strings (~`1.8e308`) for next layer.

3. **Splicing**  
   Theme: Intertwine different braids — splicing threads of entropy itself.  
   Trigger: After ~e125 – e150 total strings or a set number of braids.  
   Effect:  
   - Introduces Splice Points (new currency).  
   - Resets everything below, but grants:  
     - Permanent boost to braid efficiency (`×log10(strings)` scaling).  
     - Meta-generators that produce braid multipliers directly.  
     - Upgrade tree for automation and passive bonuses.  
   Goal: Extend run length while introducing mid-game automation.

4. **Fiber**  
   Theme: Culmination of threads — combining all previous layers into Fiber, the universal medium.  
   Trigger: Upon reaching `2^1024` Strings or certain splice milestones.  
   Effect:  
   - Hard reset of Strings, Braids, and Splices.  
   - Grants Fiber, a permanent, slow-accumulating currency used for:  
     - Global upgrades (simulation speed, UI unlocks, theme variants).  
     - Passive production when idle (“offline gains”).  
   - Each Fiber increases base string gain multiplicatively (`×1.25` per Fiber, or custom formula).  
   After Fiber, pacing restarts at a faster exponential, setting the stage for new content layers.

### Development
```bash
npm install
npm run dev    # start the Vite dev server
npm run build  # compile TypeScript to dist/
```

By default the dev server serves `index.html`, which uses `/src/index.ts` as the entry point. Production bundles land in `dist/`.
