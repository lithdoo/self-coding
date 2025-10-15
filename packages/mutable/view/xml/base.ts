import type { GlobalDeclare, InjectCSS, RefStore, TemplateTree } from "../render"

export class WarpedElement {
    constructor(
        public target: Element
    ) { }

    get namespace() {
        const tag = this.target.tagName.split(':')
        if (tag.length < 2) return ''
        else return tag[0]
    }
    get name() {
        const tag = this.target.tagName.split(':')
        return tag[1] ?? tag[0]
    }

    attr(name: string) {
        return this.target.getAttribute(name)
    }

    attrnames(){
        return this.target.getAttributeNames()
    }

    innerHTML() {
        return this.target.innerHTML
    }

    textContent() {
        return this.target.textContent
    }

    children() {
        return [...this.target.children].map(v => new WarpedElement(v))
    }
}


export class WarpedAttr {
    constructor(
        public fullname: string,
        public value: string
    ) { }

    get namespace() {
        const tag = this.fullname.split(':')
        if (tag.length < 2) return ''
        else return tag[0]
    }
    get name() {
        const tag = this.fullname.split(':')
        return tag[1] ?? tag[0]
    }
}


export interface RenderTemplateContext {
    store: RefStore
    template: TemplateTree
    global: GlobalDeclare
    css: InjectCSS
}


export interface XMLParserContext extends RenderTemplateContext {
    mods: Map<string, ParseMod>
}


export interface ParseMod {
    key: string

    dealElement?(context: {
        pid: string,
        element: WarpedElement,
        context: XMLParserContext,
        next: (id: string, children?: WarpedElement[]) => void
    }): void


    dealAttr?(context: {
        id: string,
        attr: WarpedAttr,
        context: XMLParserContext
    }): void
}


