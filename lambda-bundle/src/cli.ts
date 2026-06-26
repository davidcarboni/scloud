#!/usr/bin/env node
import { bundleLambda } from './bundle';

bundleLambda().catch((err) => {
  console.error(err);
  process.exit(1);
});
