import { build } from 'esbuild';
import { mkdirSync, readdirSync, rmSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';

/** CloudFront Functions runtime limit (see AWS docs). */
const CF_FUNCTION_MAX_BYTES = 10 * 1024;

export interface CloudFrontFunctionSpec {
  /** Entry point relative to project root, e.g. `src/websiteFunction.ts` */
  entryPoint: string;
  /** Output file relative to project root, e.g. `dist/websiteFunction.js` */
  outfile: string;
}

export interface CloudFrontBundleOptions {
  /** Project root (default: process.cwd()) */
  root?: string;
  /**
   * Functions to bundle. When omitted, bundles every `src/*Function.ts` to
   * `dist/<name>.js`.
   */
  functions?: CloudFrontFunctionSpec[];
  /** Warn when bundled output exceeds the CloudFront Functions size limit (default: true) */
  warnOnSizeLimit?: boolean;
}

function discoverFunctions(root: string): CloudFrontFunctionSpec[] {
  const srcDir = join(root, 'src');
  return readdirSync(srcDir)
    .filter((name) => name.endsWith('Function.ts'))
    .sort()
    .map((name) => ({
      entryPoint: `src/${name}`,
      outfile: `dist/${name.replace(/\.ts$/, '.js')}`,
    }));
}

function warnIfOversized(outfilePath: string, warnOnSizeLimit: boolean): void {
  if (!warnOnSizeLimit) return;
  const bytes = statSync(outfilePath).size;
  if (bytes > CF_FUNCTION_MAX_BYTES) {
    console.warn(
      `Warning: ${outfilePath} is ${bytes} bytes (CloudFront Functions limit is ${CF_FUNCTION_MAX_BYTES} bytes)`,
    );
  }
}

/**
 * Bundle CloudFront Function handler(s) with esbuild (ES5 IIFE for viewer-request/response).
 */
export async function bundleCloudFrontFunctions(options: CloudFrontBundleOptions = {}): Promise<void> {
  const root = resolve(options.root ?? process.cwd());
  const warnOnSizeLimit = options.warnOnSizeLimit ?? true;
  const functions = options.functions ?? discoverFunctions(root);

  if (functions.length === 0) {
    throw new Error(`No CloudFront functions found under ${join(root, 'src')} (expected src/*Function.ts)`);
  }

  const distDir = join(root, 'dist');
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });

  await Promise.all(functions.map(async ({ entryPoint, outfile }) => {
    const outfilePath = join(root, outfile);
    mkdirSync(dirname(outfilePath), { recursive: true });

    await build({
      entryPoints: [join(root, entryPoint)],
      outfile: outfilePath,
      bundle: true,
      minify: true,
      target: ['es5'],
      platform: 'browser',
      legalComments: 'none',
      pure: [],
      sourcemap: false,
      format: 'iife',
    });

    warnIfOversized(outfilePath, warnOnSizeLimit);
  }));
}
