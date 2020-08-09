const fs = require('fs-extra')
const path = require('path')
const prettier = require('prettier')
const fetch = require('node-fetch')
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

const generatePackageJson = ({ subgraphName }) =>
  prettier.format(
    JSON.stringify({
      name: getSubgraphBasename(subgraphName),
      license: 'UNLICENSED',
      scripts: {
        codegen: 'graph codegen',
        build: 'graph build',
        deploy:
          `graph deploy ` +
          `--node https://api.thegraph.com/deploy/ ` +
          `--ipfs https://api.thegraph.com/ipfs/ ` +
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
        '@graphprotocol/graph-cli': `${module.exports.version}`,
        '@graphprotocol/graph-ts': `0.18.0`,
      },
    }),
    { parser: 'json' },
  )

// Subgraph manifest

const getStartBlock = async(address, network, etherscanApikey) => {

  if(network == 'poa-core'){
    return 0;
  }

  const url = `https://${
    network === 'mainnet' ? 'api' : `api-${network}`
  }.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=asc${etherscanApikey?'&apikey='+etherscanApikey:''}`;

  let result = await fetch(url)
  let json = await result.json()

  // Etherscan returns a JSON object that has a `status`, a `message` and
  // a `result` field. The `status` is '0' in case of errors and '1' in
  // case of success
  if (json.status === '1') {
    return json.result.length>0? json.result[0].blockNumber:0;
  } else {
    return 0;
  }

}

const generateManifest = async ({ abis, addresses, network, contractNames, etherscanApikey }) =>
  prettier.format(
    `
specVersion: 0.0.1
schema:
  file: ./schema.graphql
dataSources:
  ${(await Promise.all(abis.map(async(abi, i) => 
 ` 
  - kind: ethereum/contract
    name: ${contractNames[i]}
    network: ${network}
    source:
      address: '${addresses[i]}'
      abi: ${contractNames[i]}
      startBlock: ${await getStartBlock(addresses[i], network, etherscanApikey)}
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.2
      language: wasm/assemblyscript
      entities:
        ${abiEvents(abi)
          .map(event => `- ${event.get('_alias')}`)
          .join('\n        ')}
      abis:
        - name: ${contractNames[i]}
          file: ./abis/${contractNames[i]}.json
      eventHandlers:
        ${abiEvents(abi)
          .map(
            event => `
        - event: ${ABI.eventSignature(event)}
          handler: handle${event.get('_alias')}`,
          )
          .join('')}
      file: ./src/${contractNames[i]}Mapping.ts`
    ))).join('')}
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
      timestamp: BigInt! # uint256
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

const generateSchema = ({ abis, indexEvents }) => {

return abis.map((abi) => {
  let events = abiEvents(abi).toJS()
  return prettier.format(
    indexEvents
      ? events.map(generateEventType).join('\n\n')
      : generateExampleEntityType(events),
    {
      parser: 'graphql',
    },
  )
 }).join('\n')
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
    entity.timestamp = event.block.timestamp
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
      if (entity == null) {
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
  { abis, addresses, network, subgraphName, indexEvents, contractNames, etherscanApikey },
  spinner,
) => {
  step(spinner, 'Generate subgraph from ABI')
  let packageJson = generatePackageJson({ subgraphName })
  let manifest = await generateManifest({ abis, addresses, network, contractNames, etherscanApikey })
  let schema = generateSchema({ abis, indexEvents, contractNames })

  const mappingMap = {};
  const abiMap = {};

  for(let i=0; i< abis.length; i++) {
    mappingMap[`${contractNames[i]}Mapping.ts`] = generateMapping({
       abi:abis[i], 
       subgraphName, 
       indexEvents, 
       contractName: contractNames[i],
       });
    abiMap[`${contractNames[i]}.json`] = prettier.format(JSON.stringify(abis[i].data), {
      parser: 'json',
    });
  }

  return {
    'package.json': packageJson,
    'subgraph.yaml': manifest,
    'schema.graphql': schema,
    src: mappingMap,
    abis: abiMap,
  }
}

const writeScaffoldDirectory = async (scaffold, directory, spinner) => {
  // Create directory itself
  fs.mkdirsSync(directory)

  Object.keys(scaffold).forEach(basename => {
    let content = scaffold[basename]
    let filename = path.join(directory, basename)

    // Write file or recurse into subdirectory
    if (typeof content === 'string') {
      fs.writeFileSync(filename, content, { encoding: 'utf-8' })
    } else {
      writeScaffoldDirectory(content, path.join(directory, basename), spinner)
    }
  })
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
