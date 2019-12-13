const fs = require('fs-extra')
const path = require('path')
const cliTest = require('./util').cliTest

describe('Init', () => {
  let baseDir = path.join(__dirname, 'init')

  let subgraphDir1 = path.join(baseDir, 'from-example')
  let subgraphDir2 = path.join(baseDir, 'from-contract')
  let subgraphDir3 = path.join(baseDir, 'from-contract-with-abi')
  let subgraphDir4 = path.join(baseDir, 'from-contract-with-abi-and-structs')
  let subgraphDir5 = path.join(baseDir, 'from-contract-with-overloaded-elements')

  const removeSubgraphDirs = () => {
    if (fs.existsSync(subgraphDir1)) {
      fs.removeSync(subgraphDir1)
    }
    if (fs.existsSync(subgraphDir2)) {
      fs.removeSync(subgraphDir2)
    }
    if (fs.existsSync(subgraphDir3)) {
      fs.removeSync(subgraphDir3)
    }
    if (fs.existsSync(subgraphDir4)) {
      fs.removeSync(subgraphDir4)
    }
    if (fs.existsSync(subgraphDir5)) {
      fs.removeSync(subgraphDir5)
    }
  }

  beforeAll(removeSubgraphDirs)
  afterAll(removeSubgraphDirs)

  cliTest(
    'From example',
    ['init', '--from-example', 'user/example-subgraph', subgraphDir1],
    'init/from-example',
    {
      exitCode: 0,
      timeout: 60000,
      cwd: baseDir,
    },
  )

  cliTest(
    'From contract',
    [
      'init',
      '--from-contract',
      '0xF87E31492Faf9A91B02Ee0dEAAd50d51d56D5d4d',
      '--network',
      'mainnet',
      'user/subgraph-from-contract',
      subgraphDir2,
    ],
    'init/from-contract',
    {
      exitCode: 0,
      timeout: 60000,
      cwd: baseDir,
    },
  )

  cliTest(
    'From contract with abi',
    [
      'init',
      '--from-contract',
      '0xF87E31492Faf9A91B02Ee0dEAAd50d51d56D5d4d',
      '--abi',
      path.join(baseDir, 'abis', 'Marketplace.json'),
      '--network',
      'mainnet',
      'user/subgraph-from-contract-with-abi',
      subgraphDir3,
    ],
    'init/from-contract-with-abi',
    { exitCode: 0, timeout: 60000, cwd: baseDir },
  )

  cliTest(
    'From contract with abi and structs',
    [
      'init',
      '--from-contract',
      '0x1E0447b19BB6EcFdAe1e4AE1694b0C3659614e4e',
      '--abi',
      path.join(baseDir, 'abis', 'SoloMargin.json'),
      '--network',
      'mainnet',
      'user/subgraph-from-contract-with-abi-and-structs',
      subgraphDir4,
    ],
    'init/from-contract-with-abi-and-structs',
    { exitCode: 0, timeout: 60000, cwd: baseDir },
  )

  cliTest(
    'From contract with overloaded elements',
    [
      'init',
      '--from-contract',
      '0x1E0447b19BB6EcFdAe1e4AE1694b0C3659614e4e',
      '--abi',
      path.join(baseDir, 'abis', 'OverloadedElements.json'),
      '--network',
      'mainnet',
      'user/subgraph-from-contract-with-overloaded-elements',
      subgraphDir5,
    ],
    'init/from-contract-with-overloaded-elements',
    { exitCode: 0, timeout: 60000, cwd: baseDir },
  )
})
