import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

export default {
  input: 'src/index.js',
  output: [
    {
      file: 'dist/index.js',
      format: 'umd',
      name: 'HlsjsHeliaLoader',
      globals: {
        'helia': 'Helia',
        '@helia/unixfs': 'HeliaUnixfs'
      }
    },
    {
      file: 'dist/index.esm.js',
      format: 'es'
    }
  ],
  external: ['helia', '@helia/unixfs'],
  plugins: [
    nodeResolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs()
  ]
}
