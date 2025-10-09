import type { EvalRef } from "../eval"
import type { MVTemplateGroup, MVTemplateNode } from "./base"



export enum MVTemplateFlowType {
    Cond = 'MVTemplateCond',
    Loop = 'MVTemplateLoop'
}


export type MVTemplateCond = MVTemplateGroup & {
    type: MVTemplateFlowType.Cond
    test: EvalRef
}


export const isMVTemplateCond = (node: MVTemplateNode): node is MVTemplateCond => {
    return node.type === 'MVTemplateCond'
}


export type MVTemplateLoop = MVTemplateGroup & {
    type: MVTemplateFlowType.Loop
    loopValue: EvalRef
    valueField: string
    indexField: string
}


export const isMVTemplateLoop = (node: MVTemplateNode): node is MVTemplateLoop => {
    return node.type === 'MVTemplateLoop'
}