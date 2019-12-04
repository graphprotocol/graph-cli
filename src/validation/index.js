module.exports = {
  validateSchema: require('./schema').validateSchema,
  validateSubgraphManifest: require('./manifest').validateSubgraphManifest,
  validateMutationsManifest: require('./manifest').validateMutationsManifest
}
