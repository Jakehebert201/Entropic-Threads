## Entropic Threads

Entropic Threads is an incremental game powered by TypeScript and Vite and built on top of the `break_eternity.js` big-number library.

### Current Features
- Cascading generator tiers that produce lower tiers every tick.
- String currency accumulation that scales with time spent away (offline gains).
- Braiding mechanic: every `BRAID_SIZE` generators adds a multiplicative braid bonus.
- Dynamic UI that reflects generator state, costs, and purchase availability in real time.
- Save/load support via local storage for persistent progression.

### Development
```
npm install
npm run dev    # start the Vite dev server
npm run build  # compile TypeScript to dist/
```

By default the dev server serves `index.html`, which uses `/src/index.ts` as the entry point. When building for production, the generated bundle lives in `dist/`.
