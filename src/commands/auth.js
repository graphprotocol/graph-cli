const chalk = require('chalk')
const { saveDeployKey } = require('../command-helpers/auth')
const { chooseNodeUrl } = require('../command-helpers/node')

const HELP = `
${chalk.bold('graph auth')} [options] ${chalk.bold('<node>')} ${chalk.bold(
  '<deploy-key>'
)}

${chalk.dim('Options:')}

      --product <subgraph-studio|hosted-service>
                                Selects the product for which to authenticate
      --studio                  Shortcut for --product subgraph-studio
  -h, --help                    Show usage information
`

const processForm = async (
  toolbox,
  {
    product,
    studio,
    node,
    deployKey,
  },
) => {
  const questions = [
    {
      type: 'select',
      name: 'product',
      message: 'Product for which to initialize',
      choices: ['subgraph-studio', 'hosted-service'],
      skip: product !== undefined || studio !== undefined || node !== undefined,
    },
    {
      type: 'password',
      name: 'deployKey',
      message: 'Deploy key',
      skip: deployKey !== undefined,
    },
  ]

  try {
    const answers = await toolbox.prompt.ask(questions)
    return answers
  } catch (e) {
    return undefined
  }
}

module.exports = {
  description: 'Sets the deploy key to use when deploying to a Graph node',
  run: async toolbox => {
    // Obtain tools
    let { filesystem, print, system } = toolbox

    // Read CLI parameters
    let {
      product,
      studio,
      h,
      help,
    } = toolbox.parameters.options
    let node = toolbox.parameters.first
    let deployKey = toolbox.parameters.second

    // Show help text if requested
    if (help || h) {
      print.info(HELP)
      return
    }

    ;({ node } = chooseNodeUrl({ product, studio, node }))
    if (!node || !deployKey) {
      const inputs = await processForm(toolbox, {
        product,
        studio,
        node,
        deployKey
      })
      if (inputs === undefined) {
        process.exit(1)
      }
      if (!node) {
        ;({ node } = chooseNodeUrl({
          product: inputs.product,
          studio,
          node,
        }))
      }
      if (!deployKey) {
        deployKey = inputs.deployKey
      }
    }

    if (!deployKey) {
      print.error(`No deploy key provided`)
      print.info(HELP)
      process.exitCode = 1
      return
    }
    if (deployKey.length > 200) {
      print.error(`Deploy key must not exceed 200 characters`)
      process.exitCode = 1
      return
    }

    try {
      await saveDeployKey(node, deployKey)
      print.success(`Deploy key set for ${node}`)
    } catch (e) {
      print.error(e)
      process.exitCode = 1
    }
  },
}
