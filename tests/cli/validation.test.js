const cliTest = require('./util').cliTest

describe('Validation', () => {
  cliTest(
    'Invalid subgraph manifest',
    ['codegen', '--skip-migrations'],
    'validation/invalid-manifest',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Invalid subgraph manifest datasources kind',
    ['codegen', '--skip-migrations'],
    'validation/invalid-manifest-datasources-kind',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Invalid subgraph manifest with datasources of kind ethereum contract',
    ['codegen', '--skip-migrations'],
    'validation/invalid-manifest-datasources-kind-ethereum-contract',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Invalid mutations manifest file',
    ['codegen', '--skip-migrations'],
    'validation/invalid-mutations-manifest-file',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Invalid mutations manifest yaml',
    ['codegen', '--skip-migrations'],
    'validation/invalid-mutations-manifest-yaml',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Invalid mutations manifest',
    ['codegen', '--skip-migrations'],
    'validation/invalid-mutations-manifest',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Invalid embedded mutations manifest',
    ['codegen', '--skip-migrations'],
    'validation/invalid-embedded-mutations-manifest',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Invalid mutations resolvers file',
    ['codegen', '--skip-migrations'],
    'validation/invalid-mutations-resolvers-file',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Invalid mutations resolvers kind',
    ['codegen', '--skip-migrations'],
    'validation/unsupported-mutations-resolvers-kind',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Invalid mutations schema',
    ['codegen', '--skip-migrations'],
    'validation/invalid-mutations-schema',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Invalid mutation argument',
    ['codegen', '--skip-migrations'],
    'validation/invalid-mutation-argument',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Invalid mutation return type',
    ['codegen', '--skip-migrations'],
    'validation/invalid-mutation-return-type',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Mutation return interface',
    ['codegen', '--skip-migrations'],
    'validation/mutation-return-interface',
    {
      exitCode: 0,
    },
  )
  cliTest(
    'Mutation defines new type',
    ['codegen', '--skip-migrations'],
    'validation/mutation-defines-new-type',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Invalid mutation input type',
    ['codegen', '--skip-migrations'],
    'validation/invalid-mutation-input-type',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Invalid mutation interface type',
    ['codegen', '--skip-migrations'],
    'validation/invalid-mutation-interface-type',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Mutation schema missing',
    ['codegen', '--skip-migrations'],
    'validation/mutation-schema-missing',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Mutation interface invalid array',
    ['codegen', '--skip-migrations'],
    'validation/mutation-interface-invalid-array',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Resolvers no default export',
    ['codegen', '--skip-migrations'],
    'validation/resolvers-no-default-export',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Resolvers no resolvers object',
    ['codegen', '--skip-migrations'],
    'validation/resolvers-no-resolvers-object',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Resolvers no Mutation object',
    ['codegen', '--skip-migrations'],
    'validation/resolvers-no-mutation-object',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Resolvers no config object',
    ['codegen', '--skip-migrations'],
    'validation/resolvers-no-config-object',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Resolvers invalid config type',
    ['codegen', '--skip-migrations'],
    'validation/resolvers-invalid-config-type',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Resolvers invalid config function',
    ['codegen', '--skip-migrations'],
    'validation/resolvers-invalid-config-function',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Resolvers invalid resolvers',
    ['codegen', '--skip-migrations'],
    'validation/resolvers-invalid-resolvers',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Resolvers not es5',
    ['codegen', '--skip-migrations'],
    'validation/resolvers-not-es5',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'ABI not found in data source',
    ['codegen', '--skip-migrations'],
    'validation/abi-not-found',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Invalid ABI files',
    ['codegen', '--skip-migrations'],
    'validation/invalid-abis',
    { exitCode: 1 },
  )
  cliTest(
    'Event not found in ABI',
    ['codegen', '--skip-migrations'],
    'validation/event-not-found',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Call function not found in the ABI',
    ['codegen', '--skip-migrations'],
    'validation/call-function-not-found',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Missing entity "id" field',
    ['codegen', '--skip-migrations'],
    'validation/missing-entity-id',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Invalid entity field types',
    ['codegen', '--skip-migrations'],
    'validation/invalid-entity-field-types',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Invalid contract addresses',
    ['codegen', '--skip-migrations'],
    'validation/invalid-contract-addresses',
  )
  cliTest(
    'Entity field arguments',
    ['codegen', '--skip-migrations'],
    'validation/entity-field-args',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Example values found in manifest',
    ['codegen', '--skip-migrations'],
    'validation/example-values-found',
    { exitCode: 0 },
  )
  cliTest(
    'Source without address is valid',
    ['codegen', '--skip-migrations'],
    'validation/source-without-address-is-valid',
    {
      exitCode: 0,
    },
  )
  cliTest(
    'Invalid data source template',
    ['codegen', '--skip-migrations'],
    'validation/invalid-data-source-template',
    { exitCode: 1 },
  )
  cliTest(
    'Invalid data source template of kind ethereum contract',
    ['codegen', '--skip-migrations'],
    'validation/invalid-data-source-template-kind-ethereum-contract',
    { exitCode: 1 },
  )
  cliTest(
    'Invalid data source template kind',
    ['codegen', '--skip-migrations'],
    'validation/invalid-data-source-template-kind',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'BigDecimal is a valid type',
    ['codegen', '--skip-migrations'],
    'validation/big-decimal-is-valid',
    {
      exitCode: 0,
    },
  )
  cliTest(
    'topic0 is valid in an event handler',
    ['codegen', '--skip-migrations'],
    'validation/topic0-is-valid',
    {
      exitCode: 0,
    },
  )
  cliTest(
    'Ethereum contract data source without handlers',
    ['codegen', '--skip-migrations'],
    'validation/ethereum-contract-without-handlers',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Missing or invalid @derivedFrom fields',
    ['codegen', '--skip-migrations'],
    'validation/missing-or-invalid-derived-from-fields',
    {
      exitCode: 1,
    },
  )
  cliTest(
    '@derivedFrom target type missing',
    ['codegen', '--skip-migrations'],
    'validation/derived-from-target-type-missing',
    {
      exitCode: 1,
    },
  )
  cliTest(
    'Deprecated template format gives nice error',
    ['codegen', '--skip-migrations'],
    'validation/nested-template-nice-error',
    {
      exitCode: 1,
    },
  )

  cliTest(
    'Duplicate data source name',
    ['codegen', '--skip-migrations'],
    'validation/duplicate-data-source-name',
    {
      exitCode: 1,
    },
  )

  cliTest(
    'Duplicate template name',
    ['codegen', '--skip-migrations'],
    'validation/duplicate-template-name',
    {
      exitCode: 1,
    },
  )

  cliTest(
    'No network names (valid)',
    ['codegen', '--skip-migrations'],
    'validation/no-network-names',
    {
      exitCode: 0,
    },
  )

  cliTest(
    'Conflicting network names',
    ['codegen', '--skip-migrations'],
    'validation/conflicting-network-names',
    {
      exitCode: 1,
    },
  )
})
