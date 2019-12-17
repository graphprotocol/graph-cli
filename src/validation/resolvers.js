const fs = require('fs')
const graphql = require('graphql/language')
const acorn = require('acorn')
const immutable = require('immutable')

module.exports.validateMutationResolvers = (resolversFile, schemaFile, { resolveFile }) => {

  const validateModule = () => {
    let errors = immutable.List()
    let resolversModule
    try {
      resolversModule = require(resolveFile(resolversFile))
    } catch (e) {
      return immutable.fromJS([
        {
          path: ['mutations', 'resolvers', 'file'],
          message: e.message
        }
      ])
    }

    // If the module has no default export
    if (!resolversModule) {
      return immutable.fromJS([
        {
          path: ['mutations', 'resolvers', 'file'],
          message: 'No default export found'
        }
      ])
    }

    // Validate default exports an object with properties resolvers and config
    if (!resolversModule.resolvers) {
      errors = errors.concat(immutable.fromJS([
        {
          path: ['mutations', 'resolvers', 'file'],
          message: "'resolvers' object not found in the default export"
        }
      ]))
    }
    if (!resolversModule.config) {
      errors = errors.concat(immutable.fromJS([
        {
          path: ['mutations', 'resolvers', 'file'],
          message: "'config' object not found in the default export"
        }
      ]))
    }

    if (!errors.isEmpty()) return errors;

    // Validate resolvers has property Mutations which includes all of the schema's mutations.
    if (!resolversModule.resolvers.Mutation) {
      errors = errors.concat(immutable.fromJS([
        {
          path: ['mutations', 'resolvers', 'file'],
          message: "'Mutation' object not found in the resolvers object"
        }
      ]))
    }

    // Validate each config "leaf" property has a function that takes one argument
    const validateLeafProp = (name, leaf, root) => {
      let leafError = immutable.List();
      const props = Object.keys(leaf)
      if (props.length > 0) {
        for (const prop of props) {
          leafError = leafError.concat(validateLeafProp(prop, leaf[prop]))
        }
        return leafError;
      }

      // If this is the root object, return without validating
      if (root) {
        return immutable.List()
      }

      if (typeof leaf !== "function") {
        return immutable.fromJS([
          {
            path: ['mutations', 'resolvers', 'file'],
            message: `config property '${name}' must be a function`
          }
        ])
      }

      if (leaf.length !== 1) {
        return immutable.fromJS([
          {
            path: ['mutations', 'resolvers', 'file'],
            message: `config property '${name}' must take one argument`
          }
        ])
      }

      return immutable.List();
    }

    errors = errors.concat(validateLeafProp('config', resolversModule.config, true))

    // Validate the resolver's shape matches the Mutation shape
    const mutationsSchema = graphql.parse(fs.readFileSync(schemaFile, 'utf-8'))
    const mutationDef = mutationsSchema.definitions.find(def => def.name.value === "Mutation")
    const resolvers = resolversModule.resolvers.Mutation

    for (const field of mutationDef.fields) {
      if (!resolvers[field.name.value]) {
        errors = errors.concat(immutable.fromJS([
          {
            path: ['mutations', 'resolvers', 'file'],
            message: `resolvers missing property ${field.name.value}`
          }
        ]))
      }
    }

    // Validate the resolver's module is ES5 compliant
    try {
      acorn.parse(fs.readFileSync(resolversFile, 'utf-8'), {
        ecmaVersion: '5', silent: true
      })
    } catch (e) {
      errors = errors.concat(immutable.fromJS([
        {
          path: ['mutations', 'resolvers', 'file'],
          message: `resolvers module is not ES5 compliant. Error: ${e}`
        }
      ]))
    }

    return errors
  }

  const errors = validateModule()

  // Unload the module
  const moduleName = require.resolve(resolveFile(resolversFile));
  delete require.cache[moduleName];

  return errors
}
