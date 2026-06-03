const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/analytics.js'],
  bundle: true,
  minify: true,
  sourcemap: false,
  target: ['es2015'],
  outfile: 'dist/analytics.js',
}).catch(() => process.exit(1));
