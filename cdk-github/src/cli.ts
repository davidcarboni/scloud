#!/usr/bin/env node
import { updateGithub } from './github';

const deleteLeftover = process.argv.includes('--delete');

updateGithub(deleteLeftover).catch((err) => {
  console.error(err);
  process.exit(1);
});
