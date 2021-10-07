
const path = require("path");
const { PurgeCSS, defaultOptions} = require('PurgeCSS');
const { ConcatSource } = require("webpack-sources");
const trimEnd = require('lodash/trimEnd');

const PLUGIN_NAME = "TailwindPurge";

const getEntryByRuntime = (compilation, chunk) => {
  const chunks = Array.from(compilation.chunks.values());
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
    this.options = options;
  }

  apply(compiler) {
    compiler.hooks.compilation.tap(PLUGIN_NAME, this.initialize);
  }

  initialize = (compilation) => {
    compilation.hooks.additionalAssets.tapPromise(PLUGIN_NAME, async () => {
      const cssAssets = Object
        .entries(compilation.assets)
        .filter(([name]) => name.endsWith('.css'));

      for (const [name, asset] of cssAssets) {
        const chunk = Array
          .from(compilation.chunks.values())
          .find(chunk => chunk.files.has(name));
        
        const { context } = chunk.entryModule || getEntryByRuntime(compilation, chunk);

        const modulesInContext = Array.from(compilation.modules.values())
          .filter(module =>
            module.type !== 'runtime' &&
            module.context === context &&
            !module.resource.endsWith('.css')
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
          safelist: this.options.safelist,
          blocklist: this.options.blocklist,
          variables: this.options.variables,
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
