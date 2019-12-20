const chalk = require('chalk')
const { validateNodeUrl, normalizeNodeUrl } = require('../command-helpers/node')
const { saveAccessToken } = require('../command-helpers/auth')

const HELP = `
${chalk.bold('graph auth')} [options] ${chalk.bold('<node>')} ${chalk.bold(
  '<access-token>',
)}

${chalk.dim('Options:')}

  -h, --help                    Show usage information
`

module.exports = {
  description: 'Sets the access token to use when deploying to a Graph node',
  run: async toolbox => {
    // Obtain tools
    let { filesystem, print, system } = toolbox

    // Read CLI parameters
    let { h, help } = toolbox.parameters.options
    let node = toolbox.parameters.first
    let accessToken = toolbox.parameters.second

    // Show help text if requested
    if (help || h) {
      print.info(HELP)
      return
    }

    // Fail if no valid Graph node was provided
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

    // Fail if no access token was provided
    if (!accessToken) {
      print.error(`No access token provided`)
      print.info(HELP)
      process.exitCode = 1
      return
    }
    if (accessToken.length > 200) {
      print.error(`Access token must not exceed 200 characters`)
      process.exitCode = 1
      return
    }

    try {
      await saveAccessToken(node, accessToken)
      print.success(`Access token set for ${node}`)
    } catch (e) {
      print.error(e)
      process.exitCode = 1
    }
  },
}
