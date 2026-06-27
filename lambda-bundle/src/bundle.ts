import { build } from 'esbuild';
import { execFileSync } from 'child_process';
import {
  copyFileSync, cpSync, mkdirSync, rmSync, writeFileSync,
} from 'fs';
import { dirname, join, resolve } from 'path';

export interface LambdaBundleOptions {
  /** Project root (default: process.cwd()) */
  root?: string;
  /** Entry point relative to root (default: 'src/lambda.ts') */
  entryPoint?: string;
  /**
   * Bundled handler file relative to root (default: 'dist/lambda.js').
   * Matches ZipFunction handler 'lambda.handler'.
   */
  outfile?: string;
  /** Paths relative to root copied into dist after bundling (files or directories) */
  assets?: string[];
  /** npm packages to leave external (merged with `aws-sdk`; default externals are always included) */
  external?: string[];
}

const DEFAULT_EXTERNAL = ['aws-sdk'];

function mergeExternal(external?: string[]): string[] {
  return [...new Set([...DEFAULT_EXTERNAL, ...(external ?? [])])];
}

function commitHash(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Bundle a Lambda handler with esbuild and prepare a dist/ directory for zipping or copying.
 */
export async function bundleLambda(options: LambdaBundleOptions = {}): Promise<void> {
  const root = resolve(options.root ?? process.cwd());
  const entryPoint = options.entryPoint ?? 'src/lambda.ts';
  const outfile = options.outfile ?? 'dist/lambda.js';
  const assets = options.assets ?? [];
  const external = mergeExternal(options.external);

  const distDir = join(root, 'dist');
  const outfilePath = join(root, outfile);

  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(dirname(outfilePath), { recursive: true });

  await build({
    entryPoints: [join(root, entryPoint)],
    bundle: true,
    minify: true,
    platform: 'node',
    target: 'node24',
    outfile: outfilePath,
    sourcemap: 'inline',
    external,
  });

  copyFileSync(join(root, 'package.json'), join(distDir, 'package.json'));

  for (const asset of assets) {
    const source = join(root, asset);
    const destination = join(distDir, asset);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination, { recursive: true });
  }

  writeFileSync(join(distDir, 'COMMIT_HASH'), commitHash());
}
