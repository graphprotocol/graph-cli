const fs = require('fs-extra')
const path = require('path')
const prettier = require('prettier')
const pkginfo = require('pkginfo')(module)

const { getSubgraphBasename } = require('./command-helpers/subgraph')
const { step } = require('./command-helpers/spinner')
const { ascTypeForEthereum, valueTypeForAsc } = require('./codegen/types')
const ABI = require('./abi')
const AbiCodeGenerator = require('./codegen/abi')
const util = require('./codegen/util')

const abiEvents = abi =>
  util.disambiguateNames({
    values: abi.data.filter(item => item.get('type') === 'event'),
    getName: event => event.get('name'),
    setName: (event, name) => event.set('_alias', name),
  })

// package.json

const generatePackageJson = ({ subgraphName, node }) =>
  prettier.format(
    JSON.stringify({
      name: getSubgraphBasename(subgraphName),
      license: 'UNLICENSED',
      scripts: {
        codegen: 'graph codegen',
        build: 'graph build',
        deploy:
          `graph deploy ` +
          `--node ${node} ` +
          subgraphName,
        'create-local': `graph create --node http://localhost:8020/ ${subgraphName}`,
        'remove-local': `graph remove --node http://localhost:8020/ ${subgraphName}`,
        'deploy-local':
          `graph deploy ` +
          `--node http://localhost:8020/ ` +
          `--ipfs http://localhost:5001 ` +
          subgraphName,
      },
      dependencies: {
        '@graphprotocol/graph-cli': `https://github.com/graphprotocol/graph-cli#otavio/update-assembly-script`,
        '@graphprotocol/graph-ts': `https://github.com/graphprotocol/graph-ts#otavio/update-assembly-script`,
      },
    }),
    { parser: 'json' },
  )

// Subgraph manifest

const generateManifest = ({ abi, address, network, contractName }) =>
  prettier.format(
    `
specVersion: 0.0.1
schema:
  file: ./schema.graphql
dataSources:
  - kind: ethereum/contract
    name: ${contractName}
    network: ${network}
    source:
      address: '${address}'
      abi: ${contractName}
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.2
      language: wasm/assemblyscript
      entities:
        ${abiEvents(abi)
          .map(event => `- ${event.get('_alias')}`)
          .join('\n        ')}
      abis:
        - name: ${contractName}
          file: ./abis/${contractName}.json
      eventHandlers:
        ${abiEvents(abi)
          .map(
            event => `
        - event: ${ABI.eventSignature(event)}
          handler: handle${event.get('_alias')}`,
          )
          .join('')}
      file: ./src/mapping.ts
`,
    { parser: 'yaml' },
  )

// Schema

const ethereumTypeToGraphQL = name => {
  let ascType = ascTypeForEthereum(name)
  return valueTypeForAsc(ascType)
}

const generateField = ({ name, type }) =>
  `${name}: ${ethereumTypeToGraphQL(type)}! # ${type}`

const generateEventFields = ({ index, input }) =>
  input.type == 'tuple'
    ? util
        .unrollTuple({ value: input, path: [input.name || `param${index}`], index })
        .map(({ path, type }) => generateField({ name: path.join('_'), type }))
    : [generateField({ name: input.name || `param${index}`, type: input.type })]

const generateEventType = event => `type ${event._alias} @entity {
      id: ID!
      ${event.inputs
        .reduce(
          (acc, input, index) => acc.concat(generateEventFields({ input, index })),
          [],
        )
        .join('\n')}
    }`

const generateExampleEntityType = events => {
  if (events.length > 0) {
    return `type ExampleEntity @entity {
  id: ID!
  count: BigInt!
  ${events[0].inputs
    .reduce((acc, input, index) => acc.concat(generateEventFields({ input, index })), [])
    .slice(0, 2)
    .join('\n')}
}`
  } else {
    return `type ExampleEntity @entity {
  id: ID!
  block: Bytes!
  transaction: Bytes!
}`
  }
}

const generateSchema = ({ abi, indexEvents }) => {
  let events = abiEvents(abi).toJS()
  return prettier.format(
    indexEvents
      ? events.map(generateEventType).join('\n\n')
      : generateExampleEntityType(events),
    {
      parser: 'graphql',
    },
  )
}

// Mapping

const generateTupleFieldAssignments = ({ keyPath, index, component }) => {
  let name = component.name || `value${index}`
  keyPath = [...keyPath, name]

  let flatName = keyPath.join('_')
  let nestedName = keyPath.join('.')

  return component.type === 'tuple'
    ? component.components.reduce(
        (acc, subComponent, subIndex) =>
          acc.concat(
            generateTupleFieldAssignments({
              keyPath,
              index: subIndex,
              component: subComponent,
            }),
          ),
        [],
      )
    : [`entity.${flatName} = event.params.${nestedName}`]
}

const generateFieldAssignment = path =>
  `entity.${path.join('_')} = event.params.${path.join('.')}`

const generateFieldAssignments = ({ index, input }) =>
  input.type === 'tuple'
    ? util
        .unrollTuple({ value: input, index, path: [input.name || `param${index}`] })
        .map(({ path }) => generateFieldAssignment(path))
    : generateFieldAssignment([input.name || `param${index}`])

const generateEventFieldAssignments = event =>
  event.inputs.reduce(
    (acc, input, index) => acc.concat(generateFieldAssignments({ input, index })),
    [],
  )

const generateEventIndexingHandlers = (events, contractName) =>
  `
  import { ${events.map(
    event => `${event._alias} as ${event._alias}Event`,
  )}} from '../generated/${contractName}/${contractName}'
  import { ${events.map(event => event._alias)} } from '../generated/schema'

  ${events
    .map(
      event =>
        `
  export function handle${event._alias}(event: ${event._alias}Event): void {
    let entity = new ${
      event._alias
    }(event.transaction.hash.toHex() + '-' + event.logIndex.toString())
    ${generateEventFieldAssignments(event).join('\n')}
    entity.save()
  }
    `,
    )
    .join('\n')}
`

const generatePlaceholderHandlers = ({ abi, events, contractName }) =>
  `
  import { BigInt } from '@graphprotocol/graph-ts'
  import { ${contractName}, ${events.map(event => event._alias)} }
    from '../generated/${contractName}/${contractName}'
  import { ExampleEntity } from '../generated/schema'

  ${events
    .map((event, index) =>
      index === 0
        ? `
    export function handle${event._alias}(event: ${event._alias}): void {
      // Entities can be loaded from the store using a string ID; this ID
      // needs to be unique across all entities of the same type
      let entity = ExampleEntity.load(event.transaction.from.toHex())

      // Entities only exist after they have been saved to the store;
      // \`null\` checks allow to create entities on demand
      if (!entity) {
        entity = new ExampleEntity(event.transaction.from.toHex())

        // Entity fields can be set using simple assignments
        entity.count = BigInt.fromI32(0)
      }

      // BigInt and BigDecimal math are supported
      entity.count = entity.count + BigInt.fromI32(1)

      // Entity fields can be set based on event parameters
      ${generateEventFieldAssignments(event)
        .slice(0, 2)
        .join('\n')}

      // Entities can be written to the store with \`.save()\`
      entity.save()

      // Note: If a handler doesn't require existing field values, it is faster
      // _not_ to load the entity from the store. Instead, create it fresh with
      // \`new Entity(...)\`, set the fields that should be updated and save the
      // entity back to the store. Fields that were not set or unset remain
      // unchanged, allowing for partial updates to be applied.

      // It is also possible to access smart contracts from mappings. For
      // example, the contract that has emitted the event can be connected to
      // with:
      //
      // let contract = Contract.bind(event.address)
      //
      // The following functions can then be called on this contract to access
      // state variables and other data:
      //
      // ${
        abi
          .codeGenerator()
          .callableFunctions()
          .isEmpty()
          ? 'None'
          : abi
              .codeGenerator()
              .callableFunctions()
              .map(fn => `- contract.${fn.get('name')}(...)`)
              .join('\n// ')
      }
    }
    `
        : `
export function handle${event._alias}(event: ${event._alias}): void {}
`,
    )
    .join('\n')}`

const generateMapping = ({ abi, indexEvents, contractName }) => {
  let events = abiEvents(abi).toJS()
  return prettier.format(
    indexEvents
      ? generateEventIndexingHandlers(events, contractName)
      : generatePlaceholderHandlers({ abi, events: events, contractName }),
    { parser: 'typescript', semi: false },
  )
}

const generateScaffold = async (
  { abi, address, network, subgraphName, indexEvents, contractName = 'Contract', node },
  spinner,
) => {
  step(spinner, 'Generate subgraph from ABI')
  let packageJson = generatePackageJson({ subgraphName, node })
  let manifest = generateManifest({ abi, address, network, contractName })
  let schema = generateSchema({ abi, indexEvents, contractName })
  let mapping = generateMapping({ abi, subgraphName, indexEvents, contractName })

  return {
    'package.json': packageJson,
    'subgraph.yaml': manifest,
    'schema.graphql': schema,
    src: { 'mapping.ts': mapping },
    abis: {
      [`${contractName}.json`]: prettier.format(JSON.stringify(abi.data), {
        parser: 'json',
      }),
    },
  }
}

const writeScaffoldDirectory = async (scaffold, directory, spinner) => {
  // Create directory itself
  await fs.mkdirs(directory)

  let promises = Object.keys(scaffold).map(async basename => {
    let content = scaffold[basename]
    let filename = path.join(directory, basename)

    // Write file or recurse into subdirectory
    if (typeof content === 'string') {
      await fs.writeFile(filename, content, { encoding: 'utf-8' })
    } else {
      writeScaffoldDirectory(content, path.join(directory, basename), spinner)
    }
  })

  await Promise.all(promises)
}

const writeScaffold = async (scaffold, directory, spinner) => {
  step(spinner, `Write subgraph to directory`)
  await writeScaffoldDirectory(scaffold, directory, spinner)
}

module.exports = {
  ...module.exports,
  abiEvents,
  generateEventFieldAssignments,
  generateManifest,
  generateMapping,
  generateScaffold,
  generateSchema,
  writeScaffold,
}
