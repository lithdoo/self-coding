import type { EvalRef } from "../eval"
import type { MVTemplateGroup, MVTemplateLeaf, MVTemplateNode } from "./base"


export enum MVTemplateComponentType {
    Root = 'MVTemplateRoot',
    Apply = 'MVTemplateApply',
    Context = 'MVTemplateContext'
}


export type MVTemplateRoot = MVTemplateGroup & {
    type: MVTemplateComponentType.Root
    props: string[]
}


export const isMVTemplateRoot = (node: MVTemplateNode): node is MVTemplateRoot => {
    return node.type === 'MVTemplateRoot'
}

export type MVTemplateApply = MVTemplateLeaf & {
    type: MVTemplateComponentType.Apply
    rootId: string
}

export const isMVTemplateApply = (node: MVTemplateNode): node is MVTemplateApply => {
    return node.type === 'MVTemplateApply'
}

export type MVTemplateContext = MVTemplateGroup & {
    type: "MVTemplateContext",
    bind: EvalRef,
}

export const isMVTemplateContext = (node: MVTemplateNode): node is MVTemplateContext => {
    return node.type === 'MVTemplateContext'
}
