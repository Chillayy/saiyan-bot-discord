// saver.js — debounced, atomic, non-blocking JSON persistence.
//
// Why: the bot used fs.writeFileSync on every character/world mutation, which blocks the
// Node event loop (no interaction can be answered while a save runs). With many players
// this stalls every command and causes Discord 10062 "Unknown interaction" timeouts.
//
// Contract (drop-in for the old writeFileSync pattern):
//   const saver = createSaver(file, () => stateObject, { label: 'characters.json' });
//   saver.save();     // mark dirty; real write happens at most once per debounce window
//   saver.saveNow();  // critical-path immediate (still async-safe) write
//   saver.flush();    // awaitable flush (used at shutdown / after batch migrations)
//   saver.flushSync(); // last-resort synchronous flush (process 'exit' handler only)
//
// Writes are atomic: JSON is written to `<file>.tmp` then renamed over the target, so a
// crash mid-write can never leave a truncated JSON file behind.
const fs = require('fs');

const _allSavers = [];
let _exitHooked = false;

// Register one shared exit hook for every saver: on normal exit (and SIGINT/SIGTERM)
// synchronously flush anything still dirty so no in-memory change is ever lost.
function hookProcessExit() {
    if (_exitHooked) return;
    _exitHooked = true;
    process.on('exit', () => {
        for (const s of _allSavers) s.flushSync();
    });
    for (const sig of ['SIGINT', 'SIGTERM']) {
        try {
            process.once(sig, () => {
                for (const s of _allSavers) s.flushSync();
                process.exit(0);
            });
        } catch (e) { /* platform may not support signals */ }
    }
}

function createSaver(filePath, getData, { debounceMs = 2000, label = filePath, logEvery = 10 } = {}) {
    let dirty = false;
    let flushing = null;
    let timer = null;
    let saves = 0;
    let lastMs = 0;
    let lastBytes = 0;

    function markDirty() {
        dirty = true;
        if (timer) return;
        timer = setTimeout(() => { timer = null; flush().catch(() => {}); }, debounceMs);
        // A pending save must never keep the process alive by itself.
        if (timer.unref) timer.unref();
    }

    async function flush() {
        // Await any in-flight write first, then keep flushing until the state is clean. This
        // guarantees `await saver.flush()` really means: everything marked dirty up to now is
        // on disk (dirt that arrives DURING a write gets its own immediate follow-up flush,
        // not just the 200ms debounce timer). Attempts are capped so a persistently failing
        // disk can never spin this loop forever — the debounce timer retries later instead.
        for (let attempt = 0; attempt < 3; attempt++) {
            if (flushing) { await flushing; continue; }
            if (!dirty) return;
            dirty = false;
            const write = (async () => {
                const t0 = Date.now();
                const data = JSON.stringify(getData(), null, 2);
                const tmp = `${filePath}.tmp`;
                await fs.promises.writeFile(tmp, data, 'utf8');
                await fs.promises.rename(tmp, filePath);
                lastMs = Date.now() - t0;
                lastBytes = Buffer.byteLength(data, 'utf8');
                saves++;
                // Telemetry: log slow flushes always, fast ones occasionally (keeps logs useful but quiet).
                if (lastMs >= 25 || saves % logEvery === 0) {
                    console.log(`[save] ${label}: ${(lastBytes / 1024).toFixed(1)}KB in ${lastMs}ms (flush #${saves})`);
                }
            })().catch(err => {
                dirty = true; // retry on the next mark/flush so data is not silently dropped
                console.error(`[save] ${label} flush failed:`, err && err.message ? err.message : err);
            });
            flushing = write;
            try {
                await write;
            } finally {
                flushing = null;
                // New dirt arrived while writing — keep the debounce timer armed for the
                // steady-state path, but the loop below flushes it right away anyway.
                if (dirty) markDirty();
            }
        }
    }

    // Synchronous last-resort flush (process exit). Safe against an in-flight async flush:
    // both write the same current state, and the rename is atomic.
    function flushSync() {
        if (timer) { clearTimeout(timer); timer = null; }
        if (!dirty) return true;
        dirty = false;
        try {
            const data = JSON.stringify(getData(), null, 2);
            const tmp = `${filePath}.tmp`;
            fs.writeFileSync(tmp, data, 'utf8');
            fs.renameSync(tmp, filePath);
            saves++;
            lastBytes = Buffer.byteLength(data, 'utf8');
            return true;
        } catch (err) {
            dirty = true;
            console.error(`[save] ${label} sync flush failed:`, err && err.message ? err.message : err);
            return false;
        }
    }

    const saver = {
        save: markDirty,          // default path — debounced, non-blocking
        saveNow: () => { markDirty(); return flush(); }, // critical path — coalesced immediate write
        flush,
        flushSync,
        markDirty,
        get stats() { return { saves, lastMs, lastBytes, dirty }; }
    };

    _allSavers.push(saver);
    hookProcessExit();
    return saver;
}

module.exports = { createSaver };
