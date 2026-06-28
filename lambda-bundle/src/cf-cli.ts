#!/usr/bin/env node
import { bundleCloudFrontFunctions } from './cfBundle';

bundleCloudFrontFunctions().catch((err) => {
  console.error(err);
  process.exit(1);
});
