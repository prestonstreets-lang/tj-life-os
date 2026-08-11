import { spawnSync } from 'node:child_process';

const commands = [
  ['node', ['--test', 'tests/progression-migration.test.mjs'], process.env],
  ['node', ['--test', 'tests/date-only.test.mjs'], { ...process.env, TZ: 'America/New_York' }],
  ['node', ['--test', 'tests/date-only.test.mjs'], { ...process.env, TZ: 'America/Los_Angeles' }],
  ['node', ['--test', 'tests/v2.1-features.test.mjs'], process.env],
  ['node', ['--test', 'tests/vision-system.test.mjs'], { ...process.env, TZ: 'America/New_York' }]
  ,['node', ['--test', 'tests/mastery-platform.test.mjs'], { ...process.env, TZ: 'America/New_York' }]
];

for (const [command, args, env] of commands) {
  const result = spawnSync(command, args, { cwd: process.cwd(), env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
