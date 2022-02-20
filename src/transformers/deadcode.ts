import { Transformer, TransformerOptions } from './transformer'
import { walk } from '../util/walk'
import { IfStatement, sp } from '../util/types'
import * as Guard from '../util/guard'
import Context from '../context'

export interface DeadCodeOptions extends TransformerOptions {}
export default class DeadCode extends Transformer<DeadCodeOptions> {
  constructor(options: Partial<DeadCodeOptions>) {
    super('DeadCode', options)
  }

  // flip alternate/consequent if test is FALSE
  flipIfStatements(context: Context) {
    walk(context.ast, {
      IfStatement(node) {
        if (!node.alternate) return

        if (!Guard.isLiteralBoolean(node.test) || node.test.value !== false)
          return

        if (
          Guard.isIfStatement(node.alternate) &&
          (!Guard.isLiteralBoolean(node.alternate.test) ||
            node.alternate.test.value !== true ||
            node.alternate.alternate)
        )
          return

        let cons = node.consequent,
          alt = Guard.isIfStatement(node.alternate)
            ? node.alternate.consequent
            : node.alternate

        node.test.value = !node.test.value
        sp<IfStatement>(node, {
          consequent: alt as any,
          alternate: cons as any,
        })
      },
    })
    return this
  }

  // remove alternates if test is TRUE
  removeDeadAlternates(context: Context) {
    walk(context.ast, {
      IfStatement(node) {
        if (!node.alternate) return
        if (!Guard.isLiteralBoolean(node.test) || node.test.value !== true)
          return
        if (Guard.isIfStatement(node.alternate)) return

        delete node.alternate
      },
    })
    return this
  }

  // move if (true) consequents to parent if no alternate flow
  fixIfStatements(context: Context) {
    walk(context.ast, {
      IfStatement(node, _, ancestors) {
        if (node.alternate) return
        if (!Guard.isLiteralBoolean(node.test) || node.test.value !== true)
          return

        let parent = ancestors[ancestors.length - 2]
        if (
          !Guard.isBlockStatement(parent) ||
          !Guard.isBlockStatement(node.consequent)
        )
          return

        let ourIdx = parent.body.findIndex(
          (n) =>
            n.type === node.type && n.start === node.start && n.end === node.end
        )
        parent.body.splice(ourIdx, 1, ...node.consequent.body)
      },
    })
    return this
  }

  public async transform(context: Context) {
    this.flipIfStatements(context)
      .removeDeadAlternates(context)
      .fixIfStatements(context)
  }
}