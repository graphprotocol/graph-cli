const { disambiguateNames, unrollTuple } = require('./util')

describe('Codegen utilities', () => {
  test('Name disambiguation', () => {
    expect(
      disambiguateNames({
        values: ['a', 'b', 'c'],
        getName: x => x,
        setName: (x, name) => name,
      }),
    ).toEqual(['a', 'b', 'c'])

    expect(
      disambiguateNames({
        values: ['a', 'a', 'a'],
        getName: x => x,
        setName: (x, name) => name,
      }),
    ).toEqual(['a', 'a1', 'a2'])

    expect(
      disambiguateNames({
        values: [
          { name: 'ExampleEvent', inputs: [] },
          { name: 'ExampleEvent', inputs: [{ type: 'uint256' }] },
          { name: 'ExampleEvent', inputs: [{ type: 'uint96' }] },
        ],
        getName: event => event.name,
        setName: (event, name) => {
          event.name = name
          return event
        },
      }),
    ).toEqual([
      { name: 'ExampleEvent', inputs: [] },
      { name: 'ExampleEvent1', inputs: [{ type: 'uint256' }] },
      { name: 'ExampleEvent2', inputs: [{ type: 'uint96' }] },
    ])
  })

  test('Tuple unrolling', () => {
    expect(
      unrollTuple({
        value: { type: 'tuple', name: 'value', components: [] },
        path: ['value'],
        index: 0,
      }),
    ).toEqual([])

    expect(
      unrollTuple({
        value: {
          type: 'tuple',
          name: 'value',
          components: [{ name: 'a', type: 'string' }],
        },
        path: ['value'],
        index: 0,
      }),
    ).toEqual([{ path: ['value', 'a'], type: 'string' }])

    expect(
      unrollTuple({
        value: {
          type: 'tuple',
          name: 'value',
          components: [
            { name: 'a', type: 'string' },
            { name: 'b', type: 'uint256' },
          ],
        },
        path: ['value'],
        index: 0,
      }),
    ).toEqual([
      { path: ['value', 'a'], type: 'string' },
      { path: ['value', 'b'], type: 'uint256' },
    ])

    expect(
      unrollTuple({
        value: {
          type: 'tuple',
          name: 'value',
          components: [
            { name: 'a', type: 'string' },
            { name: 'b', type: 'uint256' },
            {
              name: 'c',
              type: 'tuple',
              components: [
                { type: 'bytes32' },
                {
                  name: 'd',
                  type: 'tuple',
                  components: [{ name: 'd1', type: 'uint72' }],
                },
              ],
            },
          ],
        },
        path: ['value'],
        index: 1,
      }),
    ).toEqual([
      { path: ['value', 'a'], type: 'string' },
      { path: ['value', 'b'], type: 'uint256' },
      { path: ['value', 'c', 'value0'], type: 'bytes32' },
      { path: ['value', 'c', 'd', 'd1'], type: 'uint72' },
    ])
  })
})
