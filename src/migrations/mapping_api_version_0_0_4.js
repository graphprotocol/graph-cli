const fs = require('fs-extra')
const semver = require('semver')
const toolbox = require('gluegun/toolbox')
const yaml = require('js-yaml')
const { loadManifest } = require('./util/load-manifest')
const { getGraphTsVersion } = require('./util/versions')

// If any of the manifest apiVersions are 0.0.4, replace them with 0.0.5
module.exports = {
  name: 'Bump mapping apiVersion from 0.0.4 to 0.0.5',
  predicate: async ({ sourceDir, manifestFile }) => {
    // Obtain the graph-ts version, if possible
    let graphTsVersion
    try {
      graphTsVersion = await getGraphTsVersion(sourceDir)
    } catch (_) {
      // If we cannot obtain the version, return a hint that the graph-ts
      // hasn't been installed yet
      return 'graph-ts dependency not installed yet'
    }

    let manifest = loadManifest(manifestFile)
    return (
      // Only migrate if the graph-ts version is >= 0.21.0...
      semver.gte(graphTsVersion, '0.21.0') &&
      // ...and we have a manifest with mapping > apiVersion = 0.0.4
      manifest &&
      typeof manifest === 'object' &&
      Array.isArray(manifest.dataSources) &&
      (manifest.dataSources.reduce(
        (hasOldMappings, dataSource) =>
          hasOldMappings ||
          (typeof dataSource === 'object' &&
            dataSource.mapping &&
            typeof dataSource.mapping === 'object' &&
            dataSource.mapping.apiVersion === '0.0.4'),
        false,
      ) ||
        (Array.isArray(manifest.templates) &&
          manifest.templates.reduce(
            (hasOldMappings, template) =>
              hasOldMappings ||
              (typeof template === 'object' &&
                template.mapping &&
                typeof template.mapping === 'object' &&
                template.mapping.apiVersion === '0.0.4'),
            false,
          )))
    )
  },
  apply: async ({ manifestFile }) => {
    // Make sure we catch all variants; we could load the manifest
    // and replace the values in the data structures here; unfortunately
    // writing that back to the file messes with the formatting more than
    // we'd like; that's why for now, we use a simple patching approach
    await toolbox.patching.replace(
      manifestFile,
      new RegExp('apiVersion: 0.0.4', 'g'),
      'apiVersion: 0.0.5',
    )
    await toolbox.patching.replace(
      manifestFile,
      new RegExp("apiVersion: '0.0.4'", 'g'),
      "apiVersion: '0.0.5'",
    )
    await toolbox.patching.replace(
      manifestFile,
      new RegExp('apiVersion: "0.0.4"', 'g'),
      'apiVersion: "0.0.5"',
    )
  },
}
