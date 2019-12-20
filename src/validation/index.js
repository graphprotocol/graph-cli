module.exports = {
  validateSchema: require('./schema').validateSchema,
  validateManifest: require('./manifest').validateManifest,
  validateMutationResolvers: require('./resolvers').validateMutationResolvers,
}
