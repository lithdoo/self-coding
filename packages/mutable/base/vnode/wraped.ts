
export abstract class WrapedNode {
    static wrap(element: HTMLElement) {
        const node = new WarpedElement('div')
        node.target = element
        return node
    }

    static element(tagName: string) { return new WarpedElement(tagName) }
    static text(tagName: string) { return new WarpedText(tagName) }

    abstract node(): Node

    remove(): void {
        const node = this.node()
        const parent = node.parentNode
        parent?.removeChild(node)
    }
    appendTo(parent: Node): void {
        parent.appendChild(this.node())
    }
}



export class WarpedElement extends WrapedNode {
    target: HTMLElement
    constructor(tagName: string) {
        super()
        this.target = document.createElement(tagName)
    }

    appendChildren(list: WrapedNode[]) {
        const fragment = document.createDocumentFragment()
        list.forEach(v => v.appendTo(fragment))
        this.target.appendChild(fragment)
    }


    setAttrs(attrs:{[key:string]:boolean|string}){
        [...Object.entries(attrs)].forEach(([key,value])=>{
            this.attr(key,value)
        })
    }

    bindEvents(events:{[key:string]: (event: Event) => void}){
        
    }

    attr(key: string, value: string | boolean) {
        if (value === true) {
            this.target.setAttribute(key, 'true')
             if(key === 'checked'){
                (this.target as any).checked = true
            }
        } else if (value === false) {
            this.target.removeAttribute(key)
            if(key === 'checked'){
                (this.target as any).checked = false
            }
        } else {
            this.target.setAttribute(key, value)
        }
    }

    event(key: string, value: (event: Event) => void) {
        this.target.addEventListener(key, value)
    }

    node() {
        return this.target
    }
}

export class WarpedText extends WrapedNode {
    target: Text
    constructor(text: string) {
        super()
        this.target = document.createTextNode(text)
    }

    changeText(text: string) {
        this.target.textContent = text
    }

    node() {
        return this.target
    }
}

