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
    'Call handler with tuple',
    ['codegen', '--skip-migrations'],
    'validation/call-handler-with-tuple',
    {
      exitCode: 0,
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
    'Deriving from interface-typed fields is allowed',
    ['codegen', '--skip-migrations'],
    'validation/derived-from-with-interface',
    {
      exitCode: 0,
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
    'Duplicate data source functionality',
    ['codegen', '--skip-migrations'],
    'validation/duplicate-data-source-functionality',
    {
      exitCode: 0,
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

  cliTest(
    'Invalid @fulltext directive',
    ['codegen', '--skip-migrations'],
    'validation/invalid-fulltext-directive',
    {
      exitCode: 1,
    },
  )
})
