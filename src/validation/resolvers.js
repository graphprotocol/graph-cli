const fs = require('fs')
const graphql = require('graphql/language')
const acorn = require('acorn')

module.exports.validateMutationResolvers = (resolversFile, schemaFile, { resolveFile }) => {

  const validateModule = () => {
    let resolversModule
    try {
      resolversModule = require(resolveFile(resolversFile))
    } catch (e) {
      return e.message
    }

    // If the module has no default export
    if (!resolversModule) { 
      return 'No default export found'
    }

    // Validate default exports an object with properties resolvers and config
    if (!resolversModule.resolvers) {
      return "'resolvers' object not found in the default export"
    }
    if (!resolversModule.config) {
      return "'config' object not found in the default export"
    }

    // Validate resolvers has property Mutations which includes all of the schema's mutations.
    if (!resolversModule.resolvers.Mutation) {
      return "'Mutation' object not found in the resolvers object"
    }

    // Validate each config "leaf" property has a function that takes one argument
    const validateLeafProp = (name, leaf, root) => {
      const props = Object.keys(leaf)
      if (props.length > 0) {
        for (const prop of props) {
          const error = validateLeafProp(prop, leaf[prop])
          if (error) {
            return error
          }
        }
        return undefined
      }

      // If this is the root object, return without validating
      if (root) {
        return undefined
      }

      if (typeof leaf !== "function") {
        return `config property '${name}' must be a function`
      }

      if (leaf.length !== 1) {
        return `config property '${name}' must take one argument`
      }
    }

    const error = validateLeafProp('config', resolversModule.config, true)
    if (error) {
      return error
    }

    // Validate the resolver's shape matches the Mutation shape
    const mutationsSchema = graphql.parse(fs.readFileSync(schemaFile, 'utf-8'))
    const mutationDef = mutationsSchema.definitions.find(def => def.name.value === "Mutation")
    const resolvers = resolversModule.resolvers.Mutation

    for (const field of mutationDef.fields) {
      if (!resolvers[field.name.value]) {
        return `resolvers missing property ${field.name.value}`
      }
    }

    // Validate the resolver's module is ES5 compliant
    try {
    acorn.parse(fs.readFileSync(resolversFile, 'utf-8'), {
        ecmaVersion: '5', silent: true
      })
    } catch (e) {
      return `resolvers module is not ES5 compliant. Error: ${e}`
    }

    return undefined
  }

  const result = validateModule()

  // Unload the module
  const moduleName = require.resolve(resolveFile(resolversFile));
  delete require.cache[moduleName];

  return result
}
