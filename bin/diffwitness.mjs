#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { register } from 'tsx/esm/api';

register();
const cli = new URL('../src/cli.ts', import.meta.url);
process.argv[1] = fileURLToPath(cli);
await import(cli.href);
