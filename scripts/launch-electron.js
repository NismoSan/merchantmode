#!/usr/bin/env node
const { spawn } = require('child_process');
const electron = require('electron');
const path = require('path');

// Remove ELECTRON_RUN_AS_NODE so Electron runs as a proper app
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electron, [path.resolve(__dirname, '..')], {
  stdio: 'inherit',
  env,
  windowsHide: false,
});

child.on('close', (code) => process.exit(code ?? 0));
