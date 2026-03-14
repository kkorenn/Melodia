#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { spawnSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const NPM_CMD = process.platform === "win32" ? "npm.cmd" : "npm";
const REQUIRED_NODE_MAJOR = 20;

function printUsage() {
  console.log("Melodia script runner");
  console.log("");
  console.log("Usage:");
  console.log("  node scripts/cli.js <command> [options]");
  console.log("");
  console.log("Commands:");
  console.log("  setup          Install deps and create .env if missing");
  console.log("  run            Start dev mode (server + client)");
  console.log("  build          Build server/client");
  console.log("  host           Serve production build from backend");
  console.log("  release-reset  Remove local/private/runtime files");
  console.log("");
  console.log("Options:");
  console.log("  --yes          Skip confirmation for release-reset");
}

function runCommand(bin, args, options = {}) {
  const result = spawnSync(bin, args, {
    cwd: ROOT_DIR,
    stdio: "inherit",
    env: {
      ...process.env,
      ...(options.env || {})
    }
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function readCommandOutput(bin, args) {
  const result = spawnSync(bin, args, {
    cwd: ROOT_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    throw new Error(stderr || `${bin} ${args.join(" ")} exited with ${result.status}`);
  }

  return String(result.stdout || "").trim();
}

function ensureNodeVersion() {
  const major = Number.parseInt(process.versions.node.split(".")[0], 10);
  if (!Number.isFinite(major) || major < REQUIRED_NODE_MAJOR) {
    console.error(
      `Error: Node.js ${REQUIRED_NODE_MAJOR}+ is required. Current: v${process.versions.node}`
    );
    process.exit(1);
  }
}

function ensureEnvFile() {
  const envPath = path.join(ROOT_DIR, ".env");
  const examplePath = path.join(ROOT_DIR, ".env.example");

  if (fs.existsSync(envPath)) {
    console.log(".env already exists. Keeping existing file.");
    return;
  }

  if (!fs.existsSync(examplePath)) {
    throw new Error(".env.example not found");
  }

  fs.copyFileSync(examplePath, envPath);
  console.log("Created .env from .env.example");
}

function removePathIfExists(relativePath) {
  const target = path.join(ROOT_DIR, relativePath);
  if (!fs.existsSync(target)) {
    return;
  }

  fs.rmSync(target, { recursive: true, force: true });
  console.log(`Removed: ${relativePath}`);
}

function shouldDeleteFile(name) {
  const lower = name.toLowerCase();
  if (lower === ".ds_store") {
    return true;
  }
  if (lower.endsWith(".log")) {
    return true;
  }
  if (lower.endsWith(".sqlite")) {
    return true;
  }
  if (lower.endsWith(".sqlite-wal")) {
    return true;
  }
  if (lower.endsWith(".sqlite-shm")) {
    return true;
  }
  return false;
}

function deleteMatchingFilesRecursively(startDir) {
  if (!fs.existsSync(startDir)) {
    return;
  }

  const stack = [startDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === ".git") {
        continue;
      }

      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (shouldDeleteFile(entry.name)) {
        fs.rmSync(fullPath, { force: true });
        console.log(`Removed: ${path.relative(ROOT_DIR, fullPath)}`);
      }
    }
  }
}

function askQuestion(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function runSetup() {
  ensureNodeVersion();
  const npmVersion = readCommandOutput(NPM_CMD, ["--version"]);
  console.log(`Node: v${process.versions.node}`);
  console.log(`npm:  ${npmVersion}`);
  ensureEnvFile();
  runCommand(NPM_CMD, ["install"]);
  console.log("Setup complete.");
  console.log("Next: run the app with 'npm run dev' or scripts/run.sh");
}

function runDev() {
  runCommand(NPM_CMD, ["run", "dev"]);
}

function runBuild() {
  runCommand(NPM_CMD, ["run", "build"]);
}

function runHost() {
  const distPath = path.join(ROOT_DIR, "client", "dist");
  if (!fs.existsSync(distPath)) {
    console.log("client/dist not found. Building first...");
    runBuild();
  }

  runCommand(NPM_CMD, ["--prefix", "server", "run", "start"], {
    env: {
      AUTO_OPEN_BROWSER: "false"
    }
  });
}

async function runReleaseReset(skipConfirm) {
  console.log("Melodia release reset");
  console.log("");
  console.log("This will remove local/private/runtime files:");
  console.log("  - .env and .env.local");
  console.log("  - node_modules (root/client/server)");
  console.log("  - client/dist");
  console.log("  - server/data and *.sqlite*");
  console.log("  - *.log, .DS_Store");
  console.log("");
  console.log("This does NOT touch .git history.");
  console.log("");

  if (!skipConfirm) {
    const answer = await askQuestion("Type RESET to continue: ");
    if (answer !== "RESET") {
      console.log("Aborted.");
      process.exit(1);
    }
  }

  removePathIfExists(".env");
  removePathIfExists(".env.local");
  removePathIfExists("node_modules");
  removePathIfExists("client/node_modules");
  removePathIfExists("server/node_modules");
  removePathIfExists("client/dist");
  removePathIfExists("server/data");

  deleteMatchingFilesRecursively(ROOT_DIR);
  console.log("");
  console.log("Release reset complete.");
}

async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);
  const hasYesFlag = args.includes("--yes");

  try {
    switch (command) {
      case "setup":
        await runSetup();
        break;
      case "run":
        runDev();
        break;
      case "build":
        runBuild();
        break;
      case "host":
        runHost();
        break;
      case "release-reset":
        await runReleaseReset(hasYesFlag);
        break;
      case "-h":
      case "--help":
      default:
        printUsage();
        if (!command || command === "-h" || command === "--help") {
          process.exit(0);
        }
        process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
