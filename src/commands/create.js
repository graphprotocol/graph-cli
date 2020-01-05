const chalk = require('chalk')
const { validateNodeUrl } = require('../command-helpers/node')
const { identifyAccessToken } = require('../command-helpers/auth')
const { createJsonRpcClient } = require('../command-helpers/jsonrpc')

const HELP = `
${chalk.bold('graph create')} ${chalk.dim('[options]')} ${chalk.bold('<subgraph-name>')}

${chalk.dim('Options:')}

      --access-token <token>    Graph access token
  -h, --help                    Show usage information
  -g, --node <url>              Graph node to create the subgraph in
`

module.exports = {
  description: 'Registers a subgraph name',
  run: async toolbox => {
    // Obtain tools
    let { filesystem, print, system } = toolbox

    // Read CLI parameters
    let { accessToken, g, h, help, node } = toolbox.parameters.options
    let subgraphName = toolbox.parameters.first

    // Support both long and short option variants
    node = node || g
    help = help || h

    // Show help text if requested
    if (help) {
      print.info(HELP)
      return
    }

    // Validate the subgraph name
    if (!subgraphName) {
      print.error('No subgraph name provided')
      print.info(HELP)
      process.exitCode = 1
      return
    }

    // Validate node
    if (!node) {
      print.error(`No Graph node provided`)
      print.info(HELP)
      process.exitCode = 1
      return
    }
    try {
      validateNodeUrl(node)
    } catch (e) {
      print.error(`Graph node "${node}" is invalid: ${e.message}`)
      process.exitCode = 1
      return
    }

    let requestUrl = new URL(node)
    let client = createJsonRpcClient(requestUrl)

    // Exit with an error code if the client couldn't be created
    if (!client) {
      process.exitCode = 1
      return
    }

    // Use the access token, if one is set
    accessToken = await identifyAccessToken(node, accessToken)
    if (accessToken !== undefined && accessToken !== null) {
      client.options.headers = { Authorization: `Bearer ${accessToken}` }
    }

    let spinner = print.spin(`Creating subgraph in Graph node: ${requestUrl}`)
    client.request('subgraph_create', { name: subgraphName }, function(
      requestError,
      jsonRpcError,
      res,
    ) {
      if (jsonRpcError) {
        spinner.fail(`Error creating the subgraph: ${jsonRpcError.message}`)
        process.exitCode = 1
      } else if (requestError) {
        spinner.fail(`HTTP error creating the subgraph: ${requestError.code}`)
        process.exitCode = 1
      } else {
        spinner.stop()
        print.success(`Created subgraph: ${subgraphName}`)
      }
    })
  },
}
