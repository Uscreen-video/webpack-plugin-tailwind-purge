
const path = require("path");
const { PurgeCSS, defaultOptions} = require('PurgeCSS');
const { ConcatSource } = require("webpack-sources");
const trimEnd = require('lodash/trimEnd');

const PLUGIN_NAME = "TailwindPurge";

const getEntryByRuntime = (chunks, chunk) => {
  const match = chunks.find(c => c.runtime === chunk.runtime);
  return match
}

/**
 * Css extractor from tailwindcss@2
 */
const tailwindExtractor = (content) => {
  // Capture as liberally as possible, including things like `h-(screen-1.5)`
  const broadMatches = content.match(/[^<>"'`\s]*[^<>"'`\s:]/g) || [];
  const broadMatchesWithoutTrailingSlash = broadMatches.map((match) => trimEnd(match, '\\'))

  // Capture classes within other delimiters like .block(class="w-1/2") in Pug
  const innerMatches = content.match(/[^<>"'`\s.(){}[\]#=%]*[^<>"'`\s.(){}[\]#=%:]/g) || []

  return broadMatches.concat(broadMatchesWithoutTrailingSlash).concat(innerMatches)
}

class TailwindPurge {
  constructor(options) {
    this.options = options || {};
  }

  apply(compiler) {
    compiler.hooks.compilation.tap(PLUGIN_NAME, this.initialize);
  }

  initialize = (compilation) => {
    compilation.hooks.additionalAssets.tapPromise(PLUGIN_NAME, async () => {
      const cssAssets = Object
        .entries(compilation.assets)
        .filter(([name]) => name.endsWith('.css'));

      /**
       * Run compilation for every CSS asset
       */
      for (const [name, asset] of cssAssets) {

        const chunksArray = Array.from(compilation.chunks.values())
        // Find chunk this asset belong to
        const chunk = chunksArray
          .find(chunk => chunk.files instanceof Set
            ? chunk.files.has(name)
            : chunk.files.includes(name)
          );

        // Fin all modules in this entry
        const modules = compilation.chunkGraph.getChunkModules(chunk);
        const modulesInContext = modules
          .filter(module =>
            module.type !== 'runtime' &&
            module.resource && !module.resource.endsWith('.css')
          )

        const content = modulesInContext.map(module => ({
          extension: path.extname(module.resource),
          raw: module._source._value
        }))

        const extractors = this.options.extractors || defaultOptions.extractors
        const moduleOptions = this.options.modules && this.options.modules[chunk.runtime];
    
        if (moduleOptions) {
          if (moduleOptions.content) content.push(...moduleOptions.content);
          if (moduleOptions.extractors) extractors.push(...moduleOptions.extractors);
        }

        const purgecss = await new PurgeCSS().purge({
          ...defaultOptions,
          defaultExtractor: tailwindExtractor,
          safelist: this.options.safelist || [],
          blocklist: this.options.blocklist || [],
          variables: this.options.variables || [],
          extractors,
          content,
          css: [
            { raw: asset.source().toString() },
          ],
        });

        const [purged] = purgecss;
        compilation.updateAsset(name, new ConcatSource(purged.css));
      }
    })
  }
}

module.exports = TailwindPurge
