let immutable = require('immutable')
let Map = immutable.Map

class Param {
  constructor(name, type) {
    this.name = name
    this.type = type
  }

  toString() {
    return `${this.name}: ${this.type.toString()}`
  }
}

class ReturnType {
  constructor(name, type) {
    this.name = name
    this.type = type
  }

  toString() {
    return `${this.type.toString()}`
  }
}

class Method {
  constructor(name, params, returnType, body) {
    this.name = name
    this.params = params || []
    this.returnType = returnType
    this.body = body || ''
  }

  toString() {
    return `
  ${this.name}(${this.params.map(param => param.toString()).join(', ')})${
      this.returnType ? `: ${this.returnType.toString()}` : ''
    } {${this.body}
  }
`
  }
}

class StaticMethod {
  constructor(name, params, returnType, body) {
    this.name = name
    this.params = params || []
    this.returnType = returnType || 'void'
    this.body = body || ''
  }

  toString() {
    return `
  static ${this.name}(${this.params.map(param => param.toString()).join(', ')})${
      this.returnType ? `: ${this.returnType.toString()}` : ''
    } {${this.body}
  }
`
  }
}

class Class {
  constructor(name, options) {
    this.name = name
    this.extends = options.extends
    this.methods = []
    this.members = []
    this.export = options.export || false
  }

  addMember(member) {
    this.members.push(member)
  }

  addMethod(method) {
    this.methods.push(method)
  }

  toString() {
    return `
${this.export ? 'export' : ''} class ${this.name}${
      this.extends ? ` extends ${this.extends}` : ''
    } {
${this.members.map(member => member.toString()).join('\n')}
${this.methods.map(method => method.toString()).join('')}
}
`
  }
}

class ClassMember {
  constructor(name, type) {
    this.name = name
    this.type = type
  }

  toString() {
    return `  ${this.name}: ${this.type.toString()}`
  }
}

class NamedType {
  constructor(name) {
    this.name = name
  }

  toString() {
    return this.name
  }

  capitalize() {
    this.name = this.name.charAt(0).toUpperCase() + this.name.slice(1)
    return this
  }

  isPrimitive() {
    let primitives = [
      'boolean',
      'u8',
      'i8',
      'u16',
      'i16',
      'u32',
      'i32',
      'u64',
      'i64',
      'f32',
      'f64',
      'usize',
      'isize',
    ]
    return primitives.includes(this.name)
  }
}

class ArrayType {
  constructor(inner) {
    this.inner = inner
    this.name = `Array<${inner.toString()}>`
  }

  toString() {
    return this.name
  }
}

class NullableType {
  constructor(inner) {
    this.inner = inner
  }

  toString() {
    return `${this.inner.toString()} | null`
  }
}

class UnionType {
  constructor(types) {
    this.types = types
  }

  toString() {
    return this.types.map(t => t.toString()).join(' | ')
  }
}

class MaybeType {
  constructor(type) {
    this.type = type
  }

  toString() {
    return `?${this.type.name}`
  }
}

class ModuleImports {
  constructor(nameOrNames, module) {
    this.nameOrNames = nameOrNames
    this.module = module
  }

  toString() {
    return `import { ${
      typeof this.nameOrNames === 'string' ? this.nameOrNames : this.nameOrNames.join(',')
    } } from "${this.module}"`
  }
}

class ModuleImport {
  constructor(alias, module) {
    this.alias = alias
    this.module = module
  }

  toString() {
    return `import * as ${this.alias} from "${this.module}"`
  }
}

class ValueToCoercion {
  constructor(expr, type) {
    this.expr = expr
    this.type = type
  }

  toString() {
    return `${this.expr}.${valueToTypeFunction(this.type)}()`
  }
}

class ValueFromCoercion {
  constructor(expr, type) {
    this.expr = expr
    this.type = type
  }

  toString() {
    return `Value.${valueFromTypeFunction(this.type)}(${this.expr})`
  }
}

const namedType = name => new NamedType(name)
const arrayType = name => new ArrayType(name)
const param = (name, type) => new Param(name, type)
const method = (name, params, returnType, body) =>
  new Method(name, params, returnType, body)
const staticMethod = (name, params, returnType, body) =>
  new StaticMethod(name, params, returnType, body)
const klass = (name, options) => new Class(name, options)
const klassMember = (name, type) => new ClassMember(name, type)
const unionType = (...types) => new UnionType(types)
const nullableType = type => new NullableType(type)
const moduleImports = (nameOrNames, module) => new ModuleImports(nameOrNames, module)

module.exports = {
  // Types
  NullableType,
  ArrayType,

  // Code generators
  namedType,
  arrayType,
  klass,
  klassMember,
  method,
  staticMethod,
  param,
  nullableType,
  unionType,
  moduleImports,
}
