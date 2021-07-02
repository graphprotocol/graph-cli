let fs = require('fs-extra')
let immutable = require('immutable')
let path = require('path')
let yaml = require('yaml')
let { strOptions } = require('yaml/types')
let graphql = require('graphql/language')
let validation = require('./validation')
let ABI = require('./abi')

const throwCombinedError = (filename, errors) => {
  throw new Error(
    errors.reduce(
      (msg, e) =>
        `${msg}

  Path: ${e.get('path').size === 0 ? '/' : e.get('path').join(' > ')}
  ${e
    .get('message')
    .split('\n')
    .join('\n  ')}`,
      `Error in ${path.relative(process.cwd(), filename)}:`,
    ),
  )
}

const buildCombinedWarning = (filename, warnings) =>
  warnings.size > 0
    ? warnings.reduce(
        (msg, w) =>
          `${msg}
  
    Path: ${w.get('path').size === 0 ? '/' : w.get('path').join(' > ')}
    ${w
      .get('message')
      .split('\n')
      .join('\n    ')}`,
        `Warnings in ${path.relative(process.cwd(), filename)}:`,
      ) + '\n'
    : null

module.exports = class Subgraph {
  static async validate(data, { resolveFile }) {
    // Parse the default subgraph schema
    let schema = graphql.parse(
      await fs.readFile(path.join(__dirname, '..', 'manifest-schema.graphql'), 'utf-8'),
    )

    // Obtain the root `SubgraphManifest` type from the schema
    let rootType = schema.definitions.find(definition => {
      return definition.name.value === 'SubgraphManifest'
    })

    // Validate the subgraph manifest using this schema
    return validation.validateManifest(data, rootType, schema, { resolveFile })
  }

  static validateSchema(manifest, { resolveFile }) {
    let filename = resolveFile(manifest.getIn(['schema', 'file']))
    let errors = validation.validateSchema(filename)

    if (errors.size > 0) {
      errors = errors.groupBy(error => error.get('entity')).sort()
      let msg = errors.reduce((msg, errors, entity) => {
        errors = errors.groupBy(error => error.get('directive'))
        let inner_msgs = errors.reduce((msg, errors, directive) => {
          return `${msg}${
            directive
              ? `
    ${directive}:`
              : ''
          }
  ${errors
    .map(error =>
      error
        .get('message')
        .split('\n')
        .join('\n  '),
    )
    .map(msg => `${directive ? '  ' : ''}- ${msg}`)
    .join('\n  ')}`
        }, ``)
        return `${msg}

  ${entity}:${inner_msgs}`
      }, `Error in ${path.relative(process.cwd(), filename)}:`)

      throw new Error(msg)
    }
  }

  static collectDataSources(manifest) {
    return manifest
      .get('dataSources')
      .reduce(
        (dataSources, dataSource, dataSourceIndex) =>
          dataSource.get('kind') === 'ethereum/contract'
            ? dataSources.push(
                immutable.Map({ path: ['dataSources', dataSourceIndex], dataSource }),
              )
            : dataSources,
        immutable.List(),
      )
  }

  static collectDataSourceTemplates(manifest) {
    return manifest.get('templates', immutable.List()).reduce(
      (templates, template, templateIndex) =>
        template.get('kind') === 'ethereum/contract'
          ? templates.push(
              immutable.Map({
                path: ['templates', templateIndex],
                dataSource: template,
              }),
            )
          : templates,
      immutable.List(),
    )
  }

  static validateDataSourceAbis(dataSource, { resolveFile, path }) {
    // Validate that the the "source > abi" reference of all data sources
    // points to an existing ABI in the data source ABIs
    let abiName = dataSource.getIn(['source', 'abi'])
    let abiNames = dataSource.getIn(['mapping', 'abis']).map(abi => abi.get('name'))
    let nameErrors = abiNames.includes(abiName)
      ? immutable.List()
      : immutable.fromJS([
          {
            path: [...path, 'source', 'abi'],
            message: `\
ABI name '${abiName}' not found in mapping > abis.
Available ABIs:
${abiNames
  .sort()
  .map(name => `- ${name}`)
  .join('\n')}`,
          },
        ])

    // Validate that all ABI files are valid
    let fileErrors = dataSource
      .getIn(['mapping', 'abis'])
      .reduce((errors, abi, abiIndex) => {
        try {
          ABI.load(abi.get('name'), resolveFile(abi.get('file')))
          return errors
        } catch (e) {
          return errors.push(
            immutable.fromJS({
              path: [...path, 'mapping', 'abis', abiIndex, 'file'],
              message: e.message,
            }),
          )
        }
      }, immutable.List())

    return nameErrors.concat(fileErrors)
  }

  static validateAbis(manifest, { resolveFile }) {
    let dataSources = Subgraph.collectDataSources(manifest)
    let dataSourceTemplates = Subgraph.collectDataSourceTemplates(manifest)

    return dataSources.concat(dataSourceTemplates).reduce(
      (errors, dataSourceOrTemplate) =>
        errors.concat(
          Subgraph.validateDataSourceAbis(dataSourceOrTemplate.get('dataSource'), {
            resolveFile,
            path: dataSourceOrTemplate.get('path'),
          }),
        ),
      immutable.List(),
    )
  }

  static validateContractAddresses(manifest) {
    return manifest
      .get('dataSources')
      .filter(dataSource => dataSource.get('kind') === 'ethereum/contract')
      .reduce((errors, dataSource, dataSourceIndex) => {
        let path = ['dataSources', dataSourceIndex, 'source', 'address']

        // No need to validate if the source has no contract address
        if (!dataSource.get('source').has('address')) {
          return errors
        }

        let address = dataSource.getIn(['source', 'address'])

        // Validate whether the address is valid
        let pattern = /^(0x)?[0-9a-fA-F]{40}$/
        if (pattern.test(address)) {
          return errors
        } else {
          return errors.push(
            immutable.fromJS({
              path,
              message: `\
Contract address is invalid: ${address}
Must be 40 hexadecimal characters, with an optional '0x' prefix.`,
            }),
          )
        }
      }, immutable.List())
  }

  static validateDataSourceEvents(dataSource, { resolveFile, path }) {
    let abi
    try {
      // Resolve the source ABI name into a real ABI object
      let abiName = dataSource.getIn(['source', 'abi'])
      let abiEntry = dataSource
        .getIn(['mapping', 'abis'])
        .find(abi => abi.get('name') === abiName)
      abi = ABI.load(abiEntry.get('name'), resolveFile(abiEntry.get('file')))
    } catch (_) {
      // Ignore errors silently; we can't really say anything about
      // the events if the ABI can't even be loaded
      return immutable.List()
    }

    // Obtain event signatures from the mapping
    let manifestEvents = dataSource
      .getIn(['mapping', 'eventHandlers'], immutable.List())
      .map(handler => handler.get('event'))

    // Obtain event signatures from the ABI
    let abiEvents = abi.eventSignatures()

    // Add errors for every manifest event signature that is not
    // present in the ABI
    return manifestEvents.reduce(
      (errors, manifestEvent, index) =>
        abiEvents.includes(manifestEvent)
          ? errors
          : errors.push(
              immutable.fromJS({
                path: [...path, 'eventHandlers', index],
                message: `\
Event with signature '${manifestEvent}' not present in ABI '${abi.name}'.
Available events:
${abiEvents
  .sort()
  .map(event => `- ${event}`)
  .join('\n')}`,
              }),
            ),
      immutable.List(),
    )
  }

  static validateEvents(manifest, { resolveFile }) {
    let dataSources = Subgraph.collectDataSources(manifest)
    let dataSourceTemplates = Subgraph.collectDataSourceTemplates(manifest)

    return dataSources
      .concat(dataSourceTemplates)
      .reduce((errors, dataSourceOrTemplate) => {
        return errors.concat(
          Subgraph.validateDataSourceEvents(dataSourceOrTemplate.get('dataSource'), {
            resolveFile,
            path: dataSourceOrTemplate.get('path'),
          }),
        )
      }, immutable.List())
  }

  static validateCallFunctions(manifest, { resolveFile }) {
    return manifest
      .get('dataSources')
      .filter(dataSource => dataSource.get('kind') === 'ethereum/contract')
      .reduce((errors, dataSource, dataSourceIndex) => {
        let path = ['dataSources', dataSourceIndex, 'callHandlers']

        let abi
        try {
          // Resolve the source ABI name into a real ABI object
          let abiName = dataSource.getIn(['source', 'abi'])
          let abiEntry = dataSource
            .getIn(['mapping', 'abis'])
            .find(abi => abi.get('name') === abiName)
          abi = ABI.load(abiEntry.get('name'), resolveFile(abiEntry.get('file')))
        } catch (e) {
          // Ignore errors silently; we can't really say anything about
          // the call functions if the ABI can't even be loaded
          return errors
        }

        // Obtain event signatures from the mapping
        let manifestFunctions = dataSource
          .getIn(['mapping', 'callHandlers'], immutable.List())
          .map(handler => handler.get('function'))

        // Obtain event signatures from the ABI
        let abiFunctions = abi.callFunctionSignatures()

        // Add errors for every manifest event signature that is not
        // present in the ABI
        return manifestFunctions.reduce(
          (errors, manifestFunction, index) =>
            abiFunctions.includes(manifestFunction)
              ? errors
              : errors.push(
                  immutable.fromJS({
                    path: [...path, index],
                    message: `\
Call function with signature '${manifestFunction}' not present in ABI '${abi.name}'.
Available call functions:
${abiFunctions
  .sort()
  .map(tx => `- ${tx}`)
  .join('\n')}`,
                  }),
                ),
          errors,
        )
      }, immutable.List())
  }

  static validateRepository(manifest, { resolveFile }) {
    return manifest.get('repository') !==
      'https://github.com/graphprotocol/example-subgraph'
      ? immutable.List()
      : immutable.List().push(
          immutable.fromJS({
            path: ['repository'],
            message: `\
The repository is still set to https://github.com/graphprotocol/example-subgraph.
Please replace it with a link to your subgraph source code.`,
          }),
        )
  }

  static validateDescription(manifest, { resolveFile }) {
    return manifest.get('description') !== 'Gravatar for Ethereum'
      ? immutable.List()
      : immutable.List().push(
          immutable.fromJS({
            path: ['description'],
            message: `\
The description is still the one from the example subgraph.
Please update it to tell users more about your subgraph.`,
          }),
        )
  }

  static validateEthereumContractHandlers(manifest) {
    return manifest
      .get('dataSources')
      .filter(dataSource => dataSource.get('kind') === 'ethereum/contract')
      .reduce((errors, dataSource, dataSourceIndex) => {
        let path = ['dataSources', dataSourceIndex, 'mapping']

        let mapping = dataSource.get('mapping')
        let blockHandlers = mapping.get('blockHandlers', immutable.List())
        let callHandlers = mapping.get('callHandlers', immutable.List())
        let eventHandlers = mapping.get('eventHandlers', immutable.List())

        return blockHandlers.isEmpty() &&
          callHandlers.isEmpty() &&
          eventHandlers.isEmpty()
          ? errors.push(
              immutable.fromJS({
                path: path,
                message: `\
Mapping has no blockHandlers, callHandlers or eventHandlers.
At least one such handler must be defined.`,
              }),
            )
          : errors
      }, immutable.List())
  }

  // Validate that data source names are unique, so they don't overwrite each other.
  static validateUniqueDataSourceNames(manifest) {
    let names = []
    return manifest.get('dataSources').reduce((errors, dataSource, dataSourceIndex) => {
      let path = ['dataSources', dataSourceIndex, 'name']
      let name = dataSource.get('name')
      if (names.includes(name)) {
        errors = errors.push(
          immutable.fromJS({
            path,
            message: `\
More than one data source named '${name}', data source names must be unique.`,
          }),
        )
      }
      names.push(name)
      return errors
    }, immutable.List())
  }

  static validateUniqueDataSources(manifest) {
    let data_source_identifiers = immutable.List()
    return manifest.get('dataSources').reduce((errors, dataSource, dataSourceIndex) => {
      let path = ['dataSources', dataSourceIndex]
      let data_source_identifier = dataSource.get('source').merge(dataSource.get('mapping'))
      if (data_source_identifiers.includes(data_source_identifier)) {
        console.log("duplicate")
        errors = errors.push(
          immutable.fromJS({
            path,
            message: `\
This data source, '${dataSource.get('name')}', has identical source and mapping to an already declared data source.
They will both listen to the same triggers, process them with the same mappings, and generate the same entity updates.`,
          }),
        )
      }

      data_source_identifiers = data_source_identifiers.push(data_source_identifier)
      return errors
    }, immutable.List())
  }


  static validateUniqueTemplateNames(manifest) {
    let names = []
    return manifest
      .get('templates', immutable.List())
      .reduce((errors, template, templateIndex) => {
        let path = ['templates', templateIndex, 'name']
        let name = template.get('name')
        if (names.includes(name)) {
          errors = errors.push(
            immutable.fromJS({
              path,
              message: `\
More than one template named '${name}', template names must be unique.`,
            }),
          )
        }
        names.push(name)
        return errors
      }, immutable.List())
  }

  static dump(manifest) {
    strOptions.fold.lineWidth = 90
    strOptions.defaultType = 'PLAIN'

    return yaml.stringify(manifest.toJS())
  }

  static async load(filename, { skipValidation } = { skipValidation: false }) {
    // Load and validate the manifest
    let data = null

    if(filename.match(/.js$/)) {
      data = require(path.resolve(filename))
    }
    else {
      data = yaml.parse(await fs.readFile(filename, 'utf-8'))
    }

    // Helper to resolve files relative to the subgraph manifest
    let resolveFile = maybeRelativeFile =>
      path.resolve(path.dirname(filename), maybeRelativeFile)

    let manifestErrors = await Subgraph.validate(data, { resolveFile })
    if (manifestErrors.size > 0) {
      throwCombinedError(filename, manifestErrors)
    }

    let manifest = immutable.fromJS(data)

    // Validate the schema
    Subgraph.validateSchema(manifest, { resolveFile })

    // Perform other validations
    let errors = skipValidation
      ? immutable.List()
      : immutable.List.of(
          ...Subgraph.validateAbis(manifest, { resolveFile }),
          ...Subgraph.validateContractAddresses(manifest),
          ...Subgraph.validateEthereumContractHandlers(manifest),
          ...Subgraph.validateEvents(manifest, { resolveFile }),
          ...Subgraph.validateCallFunctions(manifest, { resolveFile }),
          ...Subgraph.validateUniqueDataSourceNames(manifest),
          ...Subgraph.validateUniqueTemplateNames(manifest),
        )

    if (errors.size > 0) {
      throwCombinedError(filename, errors)
    }

    // Perform warning validations
    let warnings = skipValidation
      ? immutable.List()
      : immutable.List.of(
          ...Subgraph.validateRepository(manifest, { resolveFile }),
          ...Subgraph.validateDescription(manifest, { resolveFile }),
          ...Subgraph.validateUniqueDataSource(manifest),
        )

    return {
      result: manifest,
      warning: warnings.size > 0 ? buildCombinedWarning(filename, warnings) : null,
    }
  }

  static async write(manifest, filename) {
    await fs.writeFile(filename, Subgraph.dump(manifest))
  }
}
