const fs = require('fs')
const graphql = require('graphql/language')
const immutable = require('immutable')

const List = immutable.List
const Map = immutable.Map

// Builtin scalar types
const BUILTIN_SCALAR_TYPES = [
  'Boolean',
  'Int',
  'BigDecimal',
  'String',
  'BigInt',
  'Bytes',
  'ID',
]

// Type suggestions for common mistakes
const TYPE_SUGGESTIONS = [
  ['Address', 'Bytes'],
  ['address', 'Bytes'],
  ['bytes', 'Bytes'],
  ['string', 'String'],
  ['bool', 'Boolean'],
  ['boolean', 'Boolean'],
  ['Bool', 'Boolean'],
  ['float', 'BigDecimal'],
  ['Float', 'BigDecimal'],
  ['int', 'Int'],
  ['uint', 'BigInt'],
  [/^(u|uint)(8|16|24)$/, 'Int'],
  [/^(i|int)(8|16|24|32)$/, 'Int'],
  [/^(u|uint)32$/, 'BigInt'],
  [
    /^(u|uint|i|int)(40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)$/,
    'BigInt',
  ],
]

/**
 * Returns a GraphQL type suggestion for a given input type.
 * Returns `undefined` if no suggestion is available for the type.
 */
const typeSuggestion = typeName =>
  TYPE_SUGGESTIONS.filter(([pattern, _]) => {
    return typeof pattern === 'string' ? pattern === typeName : typeName.match(pattern)
  }).map(([_, suggestion]) => suggestion)[0]

const loadSchema = filename => {
  try {
    return fs.readFileSync(filename, 'utf-8')
  } catch (e) {
    throw new Error(`Failed to load GraphQL schema: ${e}`)
  }
}

const parseSchema = doc => {
  try {
    return graphql.parse(doc)
  } catch (e) {
    throw new Error(`Invalid GraphQL schema: ${e}`)
  }
}

const validateEntityDirective = def =>
  def.directives.find(directive => directive.name.value === 'entity')
    ? List()
    : immutable.fromJS([
        {
          loc: def.loc,
          entity: def.name.value,
          message: `Defined without @entity directive`,
        },
      ])

const validateEntityID = def => {
  let idField = def.fields.find(field => field.name.value === 'id')

  if (idField === undefined) {
    return immutable.fromJS([
      {
        loc: def.loc,
        entity: def.name.value,
        message: `Missing field: id: ID!`,
      },
    ])
  }

  if (
    idField.type.kind === 'NonNullType' &&
    idField.type.type.kind === 'NamedType' &&
    idField.type.type.name.value === 'ID'
  ) {
    return List()
  } else {
    return immutable.fromJS([
      {
        loc: idField.loc,
        entity: def.name.value,
        message: `Field 'id': Entity IDs must be of type ID!`,
      },
    ])
  }
}

const validateListFieldType = (def, field) =>
  field.type.kind === 'NonNullType' &&
  field.type.kind === 'ListType' &&
  field.type.type.kind !== 'NonNullType'
    ? immutable.fromJS([
        {
          loc: field.loc,
          entity: def.name.value,
          message: `\
Field '${field.name.value}':
Field has type [${field.type.type.name.value}]! but
must have type [${field.type.type.name.value}!]!

Reason: Lists with null elements are not supported.`,
        },
      ])
    : field.type.kind === 'ListType' && field.type.type.kind !== 'NonNullType'
    ? immutable.fromJS([
        {
          loc: field.loc,
          entity: def.name.value,
          message: `\
Field '${field.name.value}':
Field has type [${field.type.type.name.value}] but
must have type [${field.type.type.name.value}!]

Reason: Lists with null elements are not supported.`,
        },
      ])
    : List()

const unwrapType = type => {
  let innerTypeFromList = listType =>
    listType.type.kind === 'NonNullType'
      ? innerTypeFromNonNull(listType.type)
      : listType.type

  let innerTypeFromNonNull = nonNullType =>
    nonNullType.type.kind === 'ListType'
      ? innerTypeFromList(nonNullType.type)
      : nonNullType.type

  // Obtain the inner-most type from the field
  return type.kind === 'NonNullType'
    ? innerTypeFromNonNull(type)
    : type.kind === 'ListType'
    ? innerTypeFromList(type)
    : type
}

const entityTypeByName = (defs, name) =>
  defs
    .filter(
      def =>
        def.kind === 'InterfaceTypeDefinition' || def.kind === 'ObjectTypeDefinition',
    )
    .filter(def => def.directives.find(directive => directive.name.value === 'entity'))
    .find(def => def.name.value === name)

const fieldTargetEntityName = field => unwrapType(field.type).name.value

const fieldTargetEntity = (defs, field) =>
  entityTypeByName(defs, fieldTargetEntityName(field))

const validateInnerFieldType = (defs, def, field, isMutationArg) => {
  let innerType = unwrapType(field.type)

  // Get the name of the type
  let typeName = innerType.name.value

  // Look up a possible suggestion for the type to catch common mistakes
  let suggestion = typeSuggestion(typeName)

  // Collect all types that we can use here: built-ins + entities + enums + interfaces
  let availableTypes = List.of(
    ...BUILTIN_SCALAR_TYPES,
    ...defs
      .filter(
        def =>
          def.kind === 'ObjectTypeDefinition' ||
          def.kind === 'EnumTypeDefinition' ||
          def.kind === 'InterfaceTypeDefinition' ||
          (isMutationArg && def.kind === 'InputObjectTypeDefinition'),
      )
      .map(def => def.name.value),
  )

  // Check whether the type name is available, otherwise return an error
  return availableTypes.includes(typeName)
    ? List()
    : immutable.fromJS([
        {
          loc: field.loc,
          entity: def.name.value,
          message: `\
Field '${field.name.value}': \
Unknown type '${typeName}'.${
            suggestion !== undefined ? ` Did you mean '${suggestion}'?` : ''
          }`,
        },
      ])
}

const validateEntityFieldType = (defs, def, field) =>
  List.of(
    ...validateListFieldType(def, field),
    ...validateInnerFieldType(defs, def, field),
  )

const validateEntityFieldArguments = (defs, def, field) =>
  field.arguments.length > 0
    ? immutable.fromJS([
        {
          loc: field.loc,
          entity: def.name.value,
          message: `\
Field '${field.name.value}': \
Field arguments are not supported.`,
        },
      ])
    : List()

const entityFieldExists = (entityDef, name) =>
  entityDef.fields.find(field => field.name.value === name) !== undefined

const validateDerivedFromDirective = (defs, def, field, directive) => {
  // Validate that there is a `field` argument and nothing else
  if (directive.arguments.length !== 1 || directive.arguments[0].name.value !== 'field') {
    return immutable.fromJS([
      {
        loc: directive.loc,
        entity: def.name.value,
        message: `\
Field '${field.name.value}': \
@derivedFrom directive must have a 'field' argument`,
      },
    ])
  }

  // Validate that the "field" argument value is a string
  if (directive.arguments[0].value.kind !== 'StringValue') {
    return immutable.fromJS([
      {
        loc: directive.loc,
        entity: def.name.value,
        message: `\
Field '${field.name.value}': \
Value of the @derivedFrom 'field' argument must be a string`,
      },
    ])
  }

  let targetEntity = fieldTargetEntity(defs, field)
  if (targetEntity === undefined) {
    // This is handled in `validateInnerFieldType` but if we don't catch
    // the undefined case here, the code below will throw, as it assumes
    // the target entity exists
    return immutable.fromJS([])
  }

  let derivedFromField = targetEntity.fields.find(
    field => field.name.value === directive.arguments[0].value.value,
  )

  if (derivedFromField === undefined) {
    return immutable.fromJS([
      {
        loc: directive.loc,
        entity: def.name.value,
        message: `\
Field '${field.name.value}': \
@derivedFrom field '${directive.arguments[0].value.value}' \
does not exist on type '${targetEntity.name.value}'`,
      },
    ])
  }

  let backrefTypeName = unwrapType(derivedFromField.type)
  let backRefEntity = entityTypeByName(defs, backrefTypeName.name.value)

  if (!backRefEntity || backRefEntity.name.value !== def.name.value) {
    return immutable.fromJS([
      {
        loc: directive.loc,
        entity: def.name.value,
        message: `\
Field '${field.name.value}': \
@derivedFrom field '${directive.arguments[0].value.value}' \
on type '${targetEntity.name.value}' must have the type \
'${def.name.value}', '${def.name.value}!' or '[${def.name.value}!]!'`,
      },
    ])
  }

  return List()
}

const validateEntityFieldDirective = (defs, def, field, directive) =>
  directive.name.value === 'derivedFrom'
    ? validateDerivedFromDirective(defs, def, field, directive)
    : List()

const validateEntityFieldDirectives = (defs, def, field) =>
  field.directives.reduce(
    (errors, directive) =>
      errors.concat(validateEntityFieldDirective(defs, def, field, directive)),
    List(),
  )

const validateEntityFields = (defs, def) =>
  def.fields.reduce(
    (errors, field) =>
      errors
        .concat(validateEntityFieldType(defs, def, field))
        .concat(validateEntityFieldArguments(defs, def, field))
        .concat(validateEntityFieldDirectives(defs, def, field)),
    List(),
  )

const validateMutationArguments = (defs, field) =>
  field.arguments.reduce(
    (errors, argument) =>
      errors.concat(validateInnerFieldType(defs, field, argument, true)),
    List(),
  )

const validateMutationReturnType = (defs, field) =>
  validateInnerFieldType(defs, field, field)

const validateMutations = (defs, def) =>
  def.fields.reduce(
    (errors, field) =>
      errors
        .concat(validateMutationArguments(defs, field))
        .concat(validateMutationReturnType(defs, field)),
    List(),
  )

const validateFields = (defs, def) =>
  def.fields.reduce(
    (errors, field) => errors.concat(validateInnerFieldType(defs, def, field)),
    List(),
  )

const typeDefinitionValidators = {
  ObjectTypeDefinition: (defs, def) =>
    def.name.value === 'Mutation'
      ? validateMutations(defs, def)
      : List.of(
          ...validateEntityDirective(def),
          ...validateEntityID(def),
          ...validateEntityFields(defs, def),
        ),

  InputObjectTypeDefinition: (defs, def) => validateFields(defs, def),

  InterfaceTypeDefinition: (defs, def) => validateFields(defs, def),
}

const validateTypeDefinition = (defs, def) =>
  typeDefinitionValidators[def.kind] !== undefined
    ? typeDefinitionValidators[def.kind](defs, def)
    : List()

const validateTypeDefinitions = defs =>
  defs.reduce((errors, def) => errors.concat(validateTypeDefinition(defs, def)), List())

const validateNoOtherTypesExceptMutation = defs =>
  defs.reduce(
    (errors, def) =>
      def.kind === 'ObjectTypeDefinition' && def.name.value !== 'Mutation'
        ? errors.concat(
            immutable.fromJS([
              {
                loc: def.loc,
                entity: def.name.value,
                message:`\
Encountered object type '${def.name.value}'. 'Mutation' is the only \
object type allowed in the mutation schema. \
\
For mutation arguments, use 'input' types. For return values, use either \
entity types from the subgraph schema or 'interface' types.`,
              },
            ]),
          )
        : errors,
    List(),
  )

const validateMutationTypeExists = defs =>
  defs.findIndex(def => def.name.value === 'Mutation') === -1
    ? immutable.fromJS([
        {
          loc: null,
          entity: 'Mutation',
          message: 'Mutation type not found',
        },
      ])
    : List()

const validateMutationsSchema = defs =>
  List.of(
    ...validateNoOtherTypesExceptMutation(defs),
    ...validateMutationTypeExists(defs),
  )

const validateSchema = (rootFile, mutationsFile) => {
  let schemaDoc = loadSchema(rootFile)

  // If the mutation schema is provided, concatenate it
  // to the end of the root schema, and validate it seperately
  if (mutationsFile) {
    // Parse the mutations schema and ensure it doesn't
    // contain new type definitions that aren't the Mutation
    let mutationsDoc = loadSchema(mutationsFile)
    let mutationsSchema = parseSchema(mutationsDoc)
    schemaDoc += `\n${mutationsDoc}`

    let errors = validateMutationsSchema(mutationsSchema.definitions)
    if (errors.size > 0) {
      return errors
    }
  }

  let schema = parseSchema(schemaDoc)
  return validateTypeDefinitions(schema.definitions)
}

module.exports = { typeSuggestion, validateSchema }
