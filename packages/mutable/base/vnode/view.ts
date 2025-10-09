
import { MutComputed } from "../../base"
import { WarpedElement, WrapedNode } from "./wraped"

export abstract class MutViewNode {
    isDestoryed: boolean = false
    abstract readonly target: MutComputed<WrapedNode[]>
    destroy() {
        this.target.dispose()
    }
}

export class MutViewFragment extends MutViewNode {
    readonly target: MutComputed<WrapedNode[]>
    constructor(
        public list: MutComputed<MutViewNode[]>
    ) {
        super()
        this.target = this.list.map((list, binder) => {
            const res = list.flatMap(ele => {
                const nodes = binder(ele.target)
                return nodes
            })
            return res
        })
    }

    destroy(): void {
        super.destroy()
        this.list.dispose()
    }
}

export class MutViewElement extends MutViewNode {



    elementNode: WarpedElement
    readonly target: MutComputed<WrapedNode[]>
    readonly onChilrenChanged = () => { this.updateChildren() }
    readonly onAttrChanged = () => { this.updateAttr() }
    readonly onEventChanged = () => { this.updateEvent() }
    private currentChildren: WrapedNode[] = []

    emitter?: (
        payload: any,
        event: { $event: Event, name: string }
    ) => void

    constructor(
        public readonly tagName: string,
        public readonly attr: MutComputed<{ [key: string]: any }>,
        public readonly event: MutComputed<{ [key: string]: any }>,
        public readonly children: MutViewFragment,
        public readonly innerHTML: MutComputed<unknown>
    ) {
        super()
        this.elementNode = WrapedNode.element(tagName)
        this.target = new MutComputed(() => [this.elementNode])
        this.children.target.on(this.onChilrenChanged)
        this.innerHTML.on(this.onChilrenChanged)
        this.attr.on(this.onAttrChanged)
        this.event.on(this.onEventChanged)
        this.updateChildren()
        this.updateEvent()
        this.updateAttr()
    }


    private updateAttr() {
        const attrs = this.attr.val()
        this.elementNode.setAttrs(attrs)
    }

    private updateEvent() {
        const eventData = this.event.val()
        const events = Object.entries(eventData).reduce((res, [key, value]) => {
            return {  ...res,  [key]: ($event: Event) => {
                    this.emitter?.(value, { name: key, $event })
                }
            }
        }, {} as { [key: string]: (e: Event) => void })
        this.elementNode.bindEvents(events)
    }

    private updateChildren() {
        this.currentChildren.forEach(v => v.remove())
        const innerHTML = this.innerHTML.val()
        if (typeof innerHTML === 'string') {
            this.currentChildren = []
            this.elementNode.target.innerHTML = innerHTML
        } else {
            this.currentChildren = this.children.target.val()
            this.elementNode.appendChildren(this.currentChildren)
        }
    }

    destroy(): void {
        super.destroy()
        this.children.destroy()
        this.attr.dispose()
        this.event.dispose()
        this.innerHTML.dispose()
    }

}

export class MutViewText extends MutViewNode {

    readonly target: MutComputed<WrapedNode[]>
    constructor(
        public text: MutComputed<string>
    ) {
        super()
        this.target = this.text.map(text => [WrapedNode.text(text)])
    }


    destroy() {
        super.destroy()
        this.text.dispose()
    }
}

export class MutViewLoop extends MutViewNode {

    readonly target: MutComputed<WrapedNode[]>
    constructor(
        public readonly list: MutComputed<unknown[]>,
        public readonly render: (val: unknown, idx: number) => MutViewFragment
    ) {
        super()
        this.target = this.list.map((v, binder) => {
            return v.flatMap((val, idx) => {
                const view = this.render(val, idx)
                const nodes = binder(view.target)
                return nodes
            })
        })
    }


    destroy(): void {
        super.destroy()
        this.list.dispose()
    }
}

export class MutViewCondition extends MutViewNode {

    readonly target: MutComputed<WrapedNode[]>

    constructor(
        public readonly test: MutComputed<boolean>,
        public readonly render: () => MutViewFragment
    ) {
        super()


        this.target = test.map((val, binder) => {
            if (val) {
                const view = this.render()
                const node = binder(view.target)
                return node
            } else {
                return []
            }
        })
    }


    destroy(): void {
        super.destroy()
        this.test.dispose()
    }

}
