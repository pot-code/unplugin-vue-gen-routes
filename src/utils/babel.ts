import type { ArrayExpression, Expression } from '@babel/types'
import { walkAST } from 'ast-walker-scope'

export function parseObjectNodeToJavascriptObject(objectNode: Expression): Record<string, any> {
  if (objectNode.type !== 'ObjectExpression') {
    throw new Error('Input must be an ObjectExpression.')
  }

  const parsedObject: Record<string, any> = {}
  walkAST(objectNode, {
    enter(node) {
      if (node.type === 'ObjectProperty') {
        const nodeKey = node.key
        let key: string
        if (nodeKey.type === 'Identifier') {
          key = nodeKey.name
        } else if (nodeKey.type === 'StringLiteral') {
          key = nodeKey.value
        } else {
          throw new Error(`Unsupported key type: ${nodeKey.type}`)
        }

        const nodeValue = node.value
        if (nodeValue.type === 'StringLiteral') {
          parsedObject[key] = nodeValue.value
        } else if (nodeValue.type === 'NullLiteral') {
          parsedObject[key] = null
        } else if (nodeValue.type === 'BooleanLiteral') {
          parsedObject[key] = nodeValue.value
        } else if (nodeValue.type === 'NumericLiteral') {
          parsedObject[key] = nodeValue.value
        } else if (nodeValue.type === 'ArrayExpression') {
          parsedObject[key] = parseArrayNodeToJavascriptArray(nodeValue)
          this.skip()
        } else if (nodeValue.type === 'ObjectExpression') {
          parsedObject[key] = parseObjectNodeToJavascriptObject(nodeValue)
          this.skip()
        } else {
          throw new Error(`Unsupported value type: ${nodeValue.type}`)
        }
      }
    },
  })
  return parsedObject
}

function parseArrayNodeToJavascriptArray(arrayNode: ArrayExpression): any[] {
  return arrayNode.elements.map((element) => {
    if (element === null) {
      return null
    }
    if (element.type === 'StringLiteral') {
      return element.value
    } else if (element.type === 'BooleanLiteral') {
      return element.value
    } else if (element.type === 'NumericLiteral') {
      return element.value
    } else if (element.type === 'ArrayExpression') {
      return parseArrayNodeToJavascriptArray(element)
    } else if (element.type === 'NullLiteral') {
      return null
    } else if (element.type === 'ObjectExpression') {
      return parseObjectNodeToJavascriptObject(element)
    } else {
      throw new Error(`Unsupported array element type: ${element.type}`)
    }
  })
}
