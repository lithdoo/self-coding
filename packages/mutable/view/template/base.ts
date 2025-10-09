
export type MVTemplateNode = {
    readonly id: string
    readonly type: string
    readonly isLeaf: boolean
}

export type MVTemplateGroup = MVTemplateNode & {
    readonly isLeaf: false
}

export type MVTemplateLeaf = MVTemplateNode & {
    readonly isLeaf: true
}

