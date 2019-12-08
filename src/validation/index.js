module.exports = {
  validateSchema: require('./schema').validateSchema,
  validateMutationSchema: require('./schema').validateMutationSchema,
  validateMutationResolvers: require('./resolvers').validateMutationResolvers,
  validateSubgraphManifest: require('./manifest').validateSubgraphManifest,
  validateMutationsManifest: require('./manifest').validateMutationsManifest
}
