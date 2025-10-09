
export type JthTemplateNode = {
    readonly id: string
    readonly type: string
    readonly isLeaf: boolean
    readonly data: unknown
}

export type JthTemplateGroup = JthTemplateNode & {
    readonly isLeaf: false
}