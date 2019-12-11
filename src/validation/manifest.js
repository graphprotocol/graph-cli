const immutable = require('immutable')
const yaml = require('js-yaml')
const path = require('path')

const List = immutable.List
const Map = immutable.Map

/**
 * Returns a user-friendly type name for a value.
 */
const typeName = value =>
  List.isList(value) ? 'list' : Map.isMap(value) ? 'map' : typeof value

/**
 * Converts an immutable or plain JavaScript value to a YAML string.
 */
const toYAML = x =>
  yaml
    .safeDump(typeName(x) === 'list' || typeName(x) === 'map' ? x.toJS() : x, {
      indent: 2,
    })
    .trim()

/**
 * Looks up the type of a field in a GraphQL object type.
 */
const getFieldType = (type, fieldName) => {
  let fieldDef = type
    .get('fields')
    .find(field => field.getIn(['name', 'value']) === fieldName)

  return fieldDef !== undefined ? fieldDef.get('type') : undefined
}

/**
 * Resolves a type in the GraphQL schema.
 */
const resolveType = (schema, type) =>
  type.has('type')
    ? resolveType(schema, type.get('type'))
    : type.get('kind') === 'NamedType'
    ? schema
        .get('definitions')
        .find(def => def.getIn(['name', 'value']) === type.getIn(['name', 'value']))
    : 'resolveType: unimplemented'

/**
 * A map of supported validators.
 */
const validators = immutable.fromJS({
  ScalarTypeDefinition: (value, ctx) =>
    validators.get(ctx.getIn(['type', 'name', 'value']))(value, ctx),

  UnionTypeDefinition: (value, ctx) => {
    const errors = List();
    const typeDeducers = {
      "mutations": (value) => {
        if (value.get('file')) {
          return "Manifest";
        } else {
          return "MutationsManifest";
        }
      },
      "mutations.resolvers": (value) => {
        if (value.get('kind') === "javascript") {
          return "JavascriptResolvers"
        }
      },
      "dataSources[$0]": (value) => {
        if (value.get('kind') === "ethereum/contract") {
          return "EthereumContractDataSource"
        }
      }
    }

    // Concat path for type deduction
    const path = ctx.get('path').toJS().reduce((prev, current, index) => {
      if(index === 0){
        return current;
      }else if(typeof current === 'number'){
        return `${prev}[$${current}]`
      }else{
        return `${prev}.${current}`
      }
    }, '');

    //Deduce type

    const typeDeduced = typeDeducers[path](value);


    //Verify type is present in ctx.type.types

    const found = immutable.fromJS(ctx.getIn(['type', 'types']).toJS().find((type)=> typeDeduced === type.name.value))

    // TODO: fix weird error where error list comes with undefined element
    //If found set type and call validateValue, else return error
    found? errors.concat(validateValue(value, ctx.set('type', found)))
    : immutable.fromJS([
      {
        path: ctx.get('path'),
        message: `Deduced type ${typeDeduced} from union, but such type is not declared in manifest-schema file`,
      },
    ])

    return List()
  },

  NamedType: (value, ctx) => {
    return validateValue(
      value,
      ctx.update('type', type => {
        return resolveType(ctx.get('schema'), type)
      }),
    )
  }
    ,

  NonNullType: (value, ctx) =>
    value !== null && value !== undefined
      ? validateValue(value, ctx.update('type', type => type.get('type')))
      : immutable.fromJS([
          {
            path: ctx.get('path'),
            message: `No value provided`,
          },
        ]),

  ListType: (value, ctx) =>
    List.isList(value)
      ? value.reduce(
          (errors, value, i) =>
            errors.concat(
              validateValue(
                value,
                ctx
                  .update('path', path => path.push(i))
                  .update('type', type => type.get('type')),
              ),
            ),
          List(),
        )
      : immutable.fromJS([
          {
            path: ctx.get('path'),
            message: `Expected list, found ${typeName(value)}:\n${toYAML(value)}`,
          },
        ]),

  ObjectTypeDefinition: (value, ctx) => {
    return Map.isMap(value)
      ? ctx
          .getIn(['type', 'fields'])
          .map(fieldDef => fieldDef.getIn(['name', 'value']))
          .concat(value.keySeq())
          .toSet()
          .reduce(
            (errors, key) =>
              getFieldType(ctx.get('type'), key)
                ? errors.concat(
                    validateValue(
                      value.get(key),
                      ctx
                        .update('path', path => path.push(key))
                        .set('type', getFieldType(ctx.get('type'), key)),
                    ),
                  )
                : errors.push(
                    key == 'templates'
                      ? immutable.fromJS({
                          path: ctx.get('path'),
                          message:
                            `The way to declare data source templates has changed, ` +
                            `please move the templates from inside data sources to ` +
                            `a \`templates:\` field at the top level of the manifest.`,
                        })
                      : immutable.fromJS({
                          path: ctx.get('path'),
                          message: `Unexpected key in map: ${key}`,
                        }),
                  ),
            List(),
          )
      : immutable.fromJS([
          {
            path: ctx.get('path'),
            message: `Expected map, found ${typeName(value)}:\n${toYAML(value)}`,
          },
        ])
  },

  String: (value, ctx) =>
    typeof value === 'string'
      ? List()
      : immutable.fromJS([
          {
            path: ctx.get('path'),
            message: `Expected string, found ${typeName(value)}:\n${toYAML(value)}`,
          },
        ]),

  BigInt: (value, ctx) =>
    typeof value === 'number'
      ? List()
      : immutable.fromJS([
          {
            path: ctx.get('path'),
            message: `Expected BigInt, found ${typeName(value)}:\n${toYAML(value)}`,
          },
        ]),

  File: (value, ctx) =>
    typeof value === 'string'
      ? require('fs').existsSync(ctx.get('resolveFile')(value))
        ? List()
        : immutable.fromJS([
            {
              path: ctx.get('path'),
              message: `File does not exist: ${path.relative(process.cwd(), value)}`,
            },
          ])
      : immutable.fromJS([
          {
            path: ctx.get('path'),
            message: `Expected filename, found ${typeName(value)}:\n${value}`,
          },
        ]),
})

const validateValue = (value, ctx) => {

  let kind = ctx.getIn(['type', 'kind'])
  let validator = validators.get(kind)

  if (validator !== undefined) {
    // If the type is nullable, accept undefined and null; if the nullable
    // type is wrapped in a `NonNullType`, the validator for that `NonNullType`
    // will catch the missing/unset value
    if (kind !== 'NonNullType' && (value === undefined || value === null)) {
      return List()
    } else {
      return validator(value, ctx)
    }
  } else {
    return immutable.fromJS([
      {
        path: ctx.get('path'),
        message: `No validator for unsupported schema type: ${kind}`,
      },
    ])
  }
}

const validateMutationResolverKind = value => {
  let supportedKinds = ['javascript']

  if (value.mutations && value.mutations.resolvers) {
    if (supportedKinds.indexOf(value.mutations.resolvers.kind) === -1) {
      return immutable.fromJS([
        {
          path: [],
          message: `Requested resolver kind ${value.mutations.resolvers.kind} is not supported. `
          + `Please use one of the following supported kind's: ${supportedKinds}`
        }
      ])
    }
  }

  return List()
}

const validateDataSourceNetworks = value => {
  let networks = [...value.dataSources, ...(value.templates || [])]
    .filter(dataSource => dataSource.kind === 'ethereum/contract')
    .reduce(
      (networks, dataSource) =>
        networks.update(dataSource.network, dataSources =>
          (dataSources || immutable.OrderedSet()).add(dataSource.name),
        ),
      immutable.OrderedMap(),
    )

  return networks.size > 1
    ? immutable.fromJS([
        {
          path: [],
          message: `Conflicting networks used in data sources and templates:
${networks
  .map(
    (dataSources, network) =>
      `  ${
        network === undefined
          ? 'Data sources and templates having no network set'
          : `Data sources and templates using '${network}'`
      }:\n${dataSources.map(ds => `    - ${ds}`).join('\n')}`,
  )
  .join('\n')}
Recommendation: Make all data sources and templates use the same network name.`,
        },
      ])
    : List()
}

const validateManifest = (value, type, schema, { resolveFile }) => {
  value
  // Validate manifest using the GraphQL schema that defines its structure
  let errors = value !== null && value !== undefined
    ? validateValue(
        immutable.fromJS(value),
        immutable.fromJS({
          schema: schema,
          type: type,
          path: [],
          errors: [],
          resolveFile,
        }),
      )
    : immutable.fromJS([
        {
          path: [],
          message: `Expected non-empty value, found ${typeName(value)}:\n  ${value}`,
        },
      ])

  // Fail early because a broken manifest prevents us from performing
  // additional validation steps
  if (!errors.isEmpty()) {
    return errors
  }

  // Validate that all data sources are for the same `network` (this includes
  // _no_ network at all)
  errors = validateDataSourceNetworks(value)

  if (!errors.isEmpty()) {
    return errors
  }

  // Validate that we support the mutation resolver kind they're requesting
  return validateMutationResolverKind(value)
}

module.exports = { validateManifest }
