import type { EvalRef } from "../eval"
import type { MVTemplateGroup, MVTemplateLeaf, MVTemplateNode } from "./base"



export enum MVTemplateHtmlType {
    Element = 'MVTemplateElement',
    Text = 'MVTemplateText'
}


export type MVTemplateElement = MVTemplateGroup & {
    type: MVTemplateHtmlType.Element,
    innerHTML?: EvalRef,
    tagName: string
    events:  {
        name: string
        value: EvalRef
    }[]
    attrs: {
        name: string
        value: EvalRef
    }[]
}

export const isMVTemplateElement = (node: MVTemplateNode): node is MVTemplateElement => {
    return node.type === 'MVTemplateElement'
}

export type MVTemplateText = MVTemplateLeaf & {
    type: MVTemplateHtmlType.Text
    text: EvalRef
}

export const isMVTemplateText = (node: MVTemplateNode): node is MVTemplateText => {
    return node.type === 'MVTemplateText'
}