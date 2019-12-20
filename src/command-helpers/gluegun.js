// Workaround for https://github.com/infinitered/gluegun/pull/464.
//
// There is currently no way in Gluegun to define command-line options
// that take no arguments (like `--watch`). As a consequence, boolean
// options like `--watch` will consume the immediately following argument,
// leading to confusing behavior.
//
// E.g. `graph deploy --watch subgraph/name
//
// Will result in
// ```
// toolbox.parameters.options === { watch: 'subgraph/name' }
// toolbox.parameters.first === undefined
// toolbox.parameters.array === []
// ```
// where what we really want is
// ```
// toolbox.parameters.options === { watch: true }
// toolbox.parameters.first = 'subgraph/name'
// toolbox.parameters.array = ['subgraph/name']
// ```
//
// The `fixParameters` function checks if any of the provided boolean
// options has a string value; if so, it pushes it to the front of the
// parameters array and returns the result of that.
//
const fixParameters = (parameters, booleanOptions) => {
  let unexpectedStringOptions = Object.keys(booleanOptions)
    .filter(key => typeof booleanOptions[key] === 'string')
    .map(key => ({ key, value: booleanOptions[key] }))

  let optionNames = unexpectedStringOptions
    .map(({ key }) => `--` + key.replace(/([A-Z])/, '-$1').toLowerCase())
    .join(', ')

  if (unexpectedStringOptions.length > 1) {
    throw new Error(
      `Unexpected value provided for one or more of ${optionNames}. See --help for more information.`,
    )
  } else if (unexpectedStringOptions.length == 1) {
    let params = parameters.array
    params.unshift(unexpectedStringOptions[0].value)
    return params
  } else {
    return parameters.array
  }
}

module.exports = {
  fixParameters,
}
