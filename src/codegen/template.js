const immutable = require('immutable')

const tsCodegen = require('./typescript')

module.exports = class DataSourceTemplateCodeGenerator {
  constructor(template) {
    this.template = template
  }

  generateModuleImports() {
    return [
      tsCodegen.moduleImports(
        ['Address', 'DataSourceTemplate', 'DataSourceContext'],
        '@graphprotocol/graph-ts',
      ),
    ]
  }

  generateTypes() {
    return immutable.List([this._generateTemplateType()])
  }

  _generateTemplateType() {
    let name = this.template.get('name')
    let base = name
      .split('/')
      .reverse()
      .shift()

    let klass = tsCodegen.klass(base, {
      export: true,
      extends: 'DataSourceTemplate',
    })
    klass.addMethod(this._generateCreateMethod())
    klass.addMethod(this._generateCreateWithContextMethod())
    return klass
  }

  _generateCreateMethod() {
    let name = this.template.get('name')
    let kind = this.template.get('kind')

    switch (kind) {
      case 'ethereum/contract':
        return tsCodegen.staticMethod(
          'create',
          [tsCodegen.param('address', tsCodegen.namedType('Address'))],
          tsCodegen.namedType('void'),
          `
          DataSourceTemplate.create('${name}', [address.toHex()])
          `,
        )

      default:
        throw new Error(
          `Data sources with kind != 'ethereum/contract' are not supported yet`,
        )
    }
  }

  _generateCreateWithContextMethod() {
    let name = this.template.get('name')
    let kind = this.template.get('kind')

    switch (kind) {
      case 'ethereum/contract':
        return tsCodegen.staticMethod(
          'createWithContext',
          [
            tsCodegen.param('address', tsCodegen.namedType('Address')),
            tsCodegen.param('context', tsCodegen.namedType('DataSourceContext')),
          ],
          tsCodegen.namedType('void'),
          `
          DataSourceTemplate.createWithContext('${name}', [address.toHex()], context)
          `,
        )

      default:
        throw new Error(
          `Data sources with kind != 'ethereum/contract' are not supported yet`,
        )
    }
  }
}
