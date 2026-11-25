import { readFileSync, readdirSync } from "node:fs";
const dir = process.argv[2];
const file = readdirSync(dir).find((f) => f.endsWith(".cpuprofile"));
const prof = JSON.parse(readFileSync(`${dir}/${file}`, "utf8"));
const self = new Map();
const byId = new Map(prof.nodes.map((n) => [n.id, n]));
const dt = prof.timeDeltas; let total = 0;
prof.samples.forEach((id, i) => { const n = byId.get(id); const k = `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url.split("/").pop()}:${n.callFrame.lineNumber + 1}`; self.set(k, (self.get(k) ?? 0) + dt[i]); total += dt[i]; });
[...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, v]) => console.log((v / 1000).toFixed(1).padStart(8), "ms", ((v / total) * 100).toFixed(1).padStart(5), "%", k));
