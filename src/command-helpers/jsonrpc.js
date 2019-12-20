const jayson = require('jayson')
const toolbox = require('gluegun/toolbox')

const createJsonRpcClient = url => {
  let params = {
    host: url.hostname,
    port: url.port,
    path: url.pathname,
  }

  if (url.protocol === 'https:') {
    return jayson.Client.https(params)
  } else if (url.protocol === 'http:') {
    return jayson.Client.http(params)
  } else {
    toolbox.print.error(
      `Unsupported protocol: ${url.protocol.substring(0, url.protocol.length - 1)}`,
    )
    toolbox.print.error(
      'The Graph Node URL must be of the following format: http(s)://host[:port]/[path]',
    )
    return null
  }
}

module.exports = {
  createJsonRpcClient,
}
