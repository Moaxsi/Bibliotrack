import { cp, mkdir, rm } from 'node:fs/promises';

// Only public assets go into the deployment output. Java, SQL and reports stay private.
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('ica/src/main/resources/static', 'dist', { recursive: true });
