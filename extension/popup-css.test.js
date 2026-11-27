"use strict";

// The popup hides elements with the `hidden` attribute. Any class rule that
// sets `display` would override the browser's default `[hidden]` style and
// keep them visible (owner report: «Reintentar» and «Olvidar todo» still
// shown), so popup.css must force `[hidden]` to stay hidden.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "popup.css"), "utf8");

test("popup.css mantiene ocultos los elementos con el atributo hidden", () => {
  assert.match(css, /(^|[\s,}])\[hidden\]\s*\{[^}]*display\s*:\s*none\s*!important/);
});
