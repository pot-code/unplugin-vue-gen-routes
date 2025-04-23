import type { CallExpression, Node, ObjectExpression, ObjectProperty, Program, StringLiteral } from '@babel/types'
import type { CustomRouteBlock } from './customBlock'
import path from 'node:path'
import { babelParse, generateTransform, getLang, isCallOf, MagicString, parseSFC } from '@vue-macros/common'
import { parseObjectNodeToJavascriptObject } from '../utils/babel'
import { warn } from './utils'

const MACRO_DEFINE_PAGE = 'definePage'
export const MACRO_DEFINE_PAGE_QUERY = /[?&]definePage\b/

function isStringLiteral(node: Node | null | undefined): node is StringLiteral {
  return node?.type === 'StringLiteral'
}

/**
 * Generate the ast from a code string and an id. Works with SFC and non-SFC files.
 */
function getCodeAst(code: string, id: string) {
  let offset = 0
  let ast: Program | undefined
  const basename = path.basename(id)
  const lang = getLang(basename)
  if (lang === 'vue') {
    const sfc = parseSFC(code, id)
    if (sfc.scriptSetup) {
      ast = sfc.getSetupAst()
      offset = sfc.scriptSetup.loc.start.offset
    } else if (sfc.script) {
      ast = sfc.getScriptAst()
      offset = sfc.script.loc.start.offset
    }
  } else if (/[jt]sx?$/.test(lang)) {
    ast = babelParse(code, lang)
  }

  const definePageNodes: CallExpression[] = (ast?.body || [])
    .map((node) => {
      const definePageCallNode = node.type === 'ExpressionStatement' ? node.expression : node
      return isCallOf(definePageCallNode, MACRO_DEFINE_PAGE) ? definePageCallNode : null
    })
    .filter((node) => !!node)

  return { ast, offset, definePageNodes }
}

export function extractDefinePageMeta(code: string, id: string) {
  const { ast, definePageNodes } = getCodeAst(code, id)
  if (!ast) return

  if (definePageNodes.length > 1) {
    throw new SyntaxError(`duplicate definePage() call`)
  }

  const definePageNode = definePageNodes[0]!

  const routeRecord = definePageNode.arguments[0]

  if (!routeRecord) {
    throw new SyntaxError(`[${id}]: definePage() expects an object expression as its only argument`)
  }

  return parseObjectNodeToJavascriptObject(routeRecord as ObjectExpression)
}

export function definePageTransform(code: string, id: string) {
  if (!code.includes(MACRO_DEFINE_PAGE)) {
    return code
  }

  const { ast, offset, definePageNodes } = getCodeAst(code, id)
  if (!ast) return

  if (definePageNodes.length > 1) {
    throw new SyntaxError(`duplicate definePage() call`)
  }

  const definePageNode = definePageNodes[0]!
  const s = new MagicString(code)
  // s.removeNode(definePageNode, { offset })
  s.remove(offset + definePageNode.start!, offset + definePageNode.end!)

  return generateTransform(s, id)
}

export function extractDefinePageNameAndPath(
  sfcCode: string,
  id: string,
): { name?: string; path?: string } | null | undefined {
  if (!sfcCode.includes(MACRO_DEFINE_PAGE)) return

  const { ast, definePageNodes } = getCodeAst(sfcCode, id)
  if (!ast) return

  if (!definePageNodes.length) {
    return
  } else if (definePageNodes.length > 1) {
    throw new SyntaxError(`duplicate definePage() call`)
  }

  const definePageNode = definePageNodes[0]!

  const routeRecord = definePageNode.arguments[0]
  if (!routeRecord) {
    throw new SyntaxError(`[${id}]: definePage() expects an object expression as its only argument`)
  }

  if (routeRecord.type !== 'ObjectExpression') {
    throw new SyntaxError(`[${id}]: definePage() expects an object expression as its only argument`)
  }

  const routeInfo: Pick<CustomRouteBlock, 'name' | 'path'> = {}

  for (const prop of routeRecord.properties) {
    if (prop.type === 'ObjectProperty' && prop.key.type === 'Identifier') {
      if (prop.key.name === 'name') {
        if (prop.value.type !== 'StringLiteral') {
          warn(`route name must be a string literal. Found in "${id}".`)
        } else {
          routeInfo.name = prop.value.value
        }
      } else if (prop.key.name === 'path') {
        if (prop.value.type !== 'StringLiteral') {
          warn(`route path must be a string literal. Found in "${id}".`)
        } else {
          routeInfo.path = prop.value.value
        }
      }
    }
  }

  return routeInfo
}

// TODO: use
export function extractRouteAlias(aliasValue: ObjectProperty['value'], id: string): string[] | void {
  if (aliasValue.type !== 'StringLiteral' && aliasValue.type !== 'ArrayExpression') {
    warn(`route alias must be a string literal. Found in "${id}".`)
  } else {
    return aliasValue.type === 'StringLiteral'
      ? [aliasValue.value]
      : aliasValue.elements.filter(isStringLiteral).map((el) => el.value)
  }
}
