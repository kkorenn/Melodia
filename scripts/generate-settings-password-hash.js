#!/usr/bin/env node
"use strict";

const crypto = require("crypto");

const password = process.argv[2];

if (!password) {
  console.error("Usage: node scripts/generate-settings-password-hash.js \"your-strong-password\"");
  process.exit(1);
}

const N = 16384;
const r = 8;
const p = 1;
const keyLength = 64;
const salt = crypto.randomBytes(16);
const digest = crypto.scryptSync(password, salt, keyLength, {
  N,
  r,
  p,
  maxmem: 256 * 1024 * 1024
});

const encoded = `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${digest.toString(
  "base64"
)}`;

console.log("Add this to your .env:");
console.log(`SETTINGS_PASSWORD_HASH=${encoded}`);
