const ABI = require('./abi')
const immutable = require('immutable')
const {
  generateEventFieldAssignments,
  generateManifest,
  generateMapping,
  generateSchema,
} = require('./scaffold')

const TEST_EVENT = {
  name: 'ExampleEvent',
  type: 'event',
  inputs: [
    { name: 'a', type: 'uint256', indexed: true },
    { name: 'b', type: 'bytes[4]' },
    { type: 'string' },
    {
      name: 'c',
      type: 'tuple',
      components: [
        { name: 'c1', type: 'uint256' },
        { type: 'bytes32' },
        { type: 'string' },
        {
          name: 'c3',
          type: 'tuple',
          components: [
            { name: 'c31', type: 'uint96' },
            { type: 'string' },
            { type: 'bytes32' },
          ],
        },
      ],
    },
    { name: 'd', type: 'string', indexed: true },
  ],
}

const OVERLOADED_EVENT = {
  name: 'ExampleEvent',
  type: 'event',
  inputs: [{ name: 'a', type: 'bytes32' }],
}

const TEST_CONTRACT = {
  name: 'ExampleContract',
  type: 'contract',
}

const TEST_CALLABLE_FUNCTIONS = [
  {
    name: 'someVariable',
    type: 'function',
    stateMutability: 'view',
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getSomeValue',
    type: 'function',
    stateMutability: 'pure',
    outputs: [{ type: 'tuple', components: [{ type: 'uint256' }] }],
  },
]

const TEST_ABI = new ABI(
  'Contract',
  undefined,
  immutable.fromJS([
    TEST_EVENT,
    OVERLOADED_EVENT,
    TEST_CONTRACT,
    ...TEST_CALLABLE_FUNCTIONS,
  ]),
)

describe('Subgraph scaffolding', () => {
  test('Manifest', () => {
    expect(
      generateManifest({
        abi: TEST_ABI,
        network: 'kovan',
        address: '0xf87e31492faf9a91b02ee0deaad50d51d56d5d4d',
        contractName: 'Contract'
      }),
    ).toEqual(`\
specVersion: 0.0.1
schema:
  file: ./schema.graphql
dataSources:
  - kind: ethereum/contract
    name: Contract
    network: kovan
    source:
      address: "0xf87e31492faf9a91b02ee0deaad50d51d56d5d4d"
      abi: Contract
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.2
      language: wasm/assemblyscript
      entities:
        - ExampleEvent
        - ExampleEvent1
      abis:
        - name: Contract
          file: ./abis/Contract.json
      eventHandlers:
        - event: ExampleEvent(indexed uint256,bytes[4],string,(uint256,bytes32,string,(uint96,string,bytes32)),indexed string)
          handler: handleExampleEvent
        - event: ExampleEvent(bytes32)
          handler: handleExampleEvent1
      file: ./src/mapping.ts
`)
  })

  test('Schema (default)', () => {
    expect(generateSchema({ abi: TEST_ABI })).toEqual(`\
type ExampleEntity @entity {
  id: ID!
  count: BigInt!
  a: BigInt! # uint256
  b: [Bytes]! # bytes[4]
}
`)
  })

  test('Schema (for indexing events)', () => {
    expect(generateSchema({ abi: TEST_ABI, indexEvents: true })).toEqual(`\
type ExampleEvent @entity {
  id: ID!
  a: BigInt! # uint256
  b: [Bytes]! # bytes[4]
  param2: String! # string
  c_c1: BigInt! # uint256
  c_value1: Bytes! # bytes32
  c_value2: String! # string
  c_c3_c31: BigInt! # uint96
  c_c3_value1: String! # string
  c_c3_value2: Bytes! # bytes32
  d: String! # string
}

type ExampleEvent1 @entity {
  id: ID!
  a: Bytes! # bytes32
}
`)
  })

  test('Mapping (default)', () => {
    expect(generateMapping({ abi: TEST_ABI, contractName: 'Contract' })).toEqual(`\
import { BigInt } from "@graphprotocol/graph-ts"
import {
  Contract,
  ExampleEvent,
  ExampleEvent1
} from "../generated/Contract/Contract"
import { ExampleEntity } from "../generated/schema"

export function handleExampleEvent(event: ExampleEvent): void {
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
  entity.a = event.params.a
  entity.b = event.params.b

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
  // - contract.someVariable(...)
  // - contract.getSomeValue(...)
}

export function handleExampleEvent1(event: ExampleEvent1): void {}
`)
  })

  test('Mapping (for indexing events)', () => {
    expect(generateMapping({ abi: TEST_ABI, indexEvents: true, contractName: 'Contract' })).toEqual(`\
import {
  ExampleEvent as ExampleEventEvent,
  ExampleEvent1 as ExampleEvent1Event
} from "../generated/Contract/Contract"
import { ExampleEvent, ExampleEvent1 } from "../generated/schema"

export function handleExampleEvent(event: ExampleEventEvent): void {
  let entity = new ExampleEvent(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  )
  entity.a = event.params.a
  entity.b = event.params.b
  entity.param2 = event.params.param2
  entity.c_c1 = event.params.c.c1
  entity.c_value1 = event.params.c.value1
  entity.c_value2 = event.params.c.value2
  entity.c_c3_c31 = event.params.c.c3.c31
  entity.c_c3_value1 = event.params.c.c3.value1
  entity.c_c3_value2 = event.params.c.c3.value2
  entity.d = event.params.d
  entity.save()
}

export function handleExampleEvent1(event: ExampleEvent1Event): void {
  let entity = new ExampleEvent1(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  )
  entity.a = event.params.a
  entity.save()
}
`)
  })
})
