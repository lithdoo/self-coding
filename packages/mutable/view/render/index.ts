// import { MutBase, MutTable, MutVal, type Mut } from "../base/mut";

import { Mutable, MutComputed, MutRecord } from "../../base";
import { MutViewCondition, MutViewElement, MutViewFragment, MutViewLoop, MutViewNode, MutViewText } from "../../base/vnode";
import { isEvalRef, StaticEvalVal, type EvalRef, type EvalVal } from "../eval";
import { isMVTemplateApply, isMVTemplateCond, isMVTemplateContext, isMVTemplateElement, isMVTemplateLoop, isMVTemplateRoot, isMVTemplateText, type MVTemplateNode } from "../template";
import type { RenderTemplateContext } from "../xml/base";


export interface RefStore {
    values: { [key: string]: EvalVal }
}


export interface TemplateTree {
    children: { [key: string]: string[] }
    values: { [key: string]: MVTemplateNode }
}


export interface GlobalDeclare {
    components: {
        [key: string]: {
            rootId: string,
            private?: boolean
        }
    }
}

export interface InjectCSS {
    values: { [key: string]: { id: string, content: string } }
}


type ValueField = {
    name: string
    value: EvalRef
}

type EvalRefId = string
type VarKeyName = string





class MutSplit {

    readonly target: Record<string, MutComputed<unknown>> = {}

    constructor(
        public source: MutComputed<unknown>
    ) {
        const val = source.val()
        if (!val || typeof val !== 'object') {
            source.dispose()
            return
        }
        const keys = [...Object.keys(val)]
        if (keys.length === 0) {
            source.dispose()
            return
        }

        keys.forEach(key => {
            const parent = this
            this.target[key] = new class extends MutComputed<unknown> {
                constructor() {
                    super((bind) => {
                        const val = bind(source)
                        return val?.[key]
                    })
                }

                dispose(): void {
                    parent.dispose(key)
                }
            }
        })

    }

    desposed = new Set<string>()
    dispose(key: string) {
        this.desposed.add(key);
        const shouldDispose = [...Object.keys(this.target)].findIndex(
            (cur) => !this.desposed.has(cur)
        ) < 0
        if (shouldDispose) {
            this.source.dispose()
        }
    }
}








class RenderContext {


    constructor(
        private readonly store: RefStore,
        public readonly state: Record<VarKeyName, MutComputed<unknown>>,
        private readonly upper?: RenderContext
    ) {
        if (upper) {
            upper.children.add(this)
        }
    }


    children: Set<RenderContext> = new Set()

    extend(list: { name: string, value: EvalRef | MutComputed<unknown> }[]) {
        const state = list.map(({ name, value }) => {
            if (isEvalRef(value)) {
                return { name, value: this.val(value) }
            } else {
                return { name, value }
            }
        }).reduce((res, { name, value }) => {
            return { ...res, [name]: value }
        }, {} as Record<VarKeyName, MutComputed<unknown>>)

        return new RenderContext(this.store, state, this)
    }



    val(ref: EvalRef) {
        const vg = this.getEvalValue(ref)

        if (vg.type === 'json') {
            return this.getJsonVal(vg.content)
        }
        if (vg.type === 'eval:js') {
            return this.getScriptVal(vg.content)
        }
        throw new Error('unknown vg type')
    }



    private getState(): Record<string, Mutable<unknown>> {
        const upper = this.upper?.getState() ?? {}
        const target = this.state
        return { ...upper, ...target }
    }

    private getEvalValue(ref: EvalRef): EvalVal {
        const vg: EvalVal = (StaticEvalVal as any)[ref._VALUE_GENERATOR_REFERENCE_]
            ?? this.store.values[ref._VALUE_GENERATOR_REFERENCE_]

        if (!vg) { throw new Error('unknown ref key') }
        return vg
    }

    private getJsonVal(json: string) {
        return new MutComputed(() => JSON.parse(json))
    }

    private getScriptVal(script: string) {
        try {
            const argus = Object.entries(this.getState())
            return new MutComputed((binder) =>
                new Function(...argus.map(([v]) => v), script)
                    .apply({ binder }, argus.map(([_, v]) => binder(v)))
            )
        } catch (e) {
            console.error({ this: this, script })
            throw e
        }
    }


    distroy() {
        [...Object.values(this.state)].forEach(v => v.dispose());
        [...this.children].forEach(v => v.distroy())
    }



    // todo
    attr(data: ValueField[]) {
        const val = data.reduce((res, cur) => {
            const exist = res[cur.name]
            return { ...res, [cur.name]: exist ? exist.concat([this.val(cur.value)]) : [this.val(cur.value)] }
        }, {} as { [key: string]: MutComputed<any>[] })

        return val
    }

    // getTable(): Map<EvalRefId, EvalVal> {
    //     const upper = this.upper?.getTable() ?? new Map()

    //     return [...this.table.entries()].reduce((map, [key, val]) => {
    //         map.set(key, val)
    //         return map
    //     }, upper)
    // }

}



export class MVRenderer {

    constructor(
        public context: RenderTemplateContext
    ) { }

    get store() { return this.context.store }
    get template() { return this.context.template }
    get global() { return this.context.global }
    get css() { return this.context.css }

    createScope() { }

    renderRoot(
        name: string,
        prop: { [key: string]: MutComputed<unknown> },
        emitter: (payload: any, event: { $event: Event, name: string }) => void
    ) {
        const component = this.global.components[name]
        if (!component) throw new Error('unknown')

        const node = this.template.values[component.rootId]
        if (!node) throw new Error('unknown')

        if (!isMVTemplateRoot(node))
            throw new Error('error root id!')

        const state = prop
        const scope = new RenderContext(
            this.store, state
        )

        const css = [...Object.values(this.css.values)].map(v => {
            const { id, content } = v
            return new MutViewElement(
                'style',
                new MutComputed(() => ({ id: id })),
                new MutComputed(() => ({})),
                new MutViewFragment(new MutComputed(() => []),),
                new MutComputed(() => (content)),
            )
        }).concat([
            new MutViewElement(
                'style',
                new MutComputed(() => ({})),
                new MutComputed(() => ({})),
                new MutViewFragment(new MutComputed(() => []),),
                new MutComputed(() => '*{box-sizing:border-box}')
            )
        ])

        return new MutRootFragment(new MutComputed(() => [
            ...css, this.renderNode(node.id, scope, emitter)
        ]), scope)
        // return this.renderNode(node.id, scope)
    }

    renderChildren(id: string, context: RenderContext, emitter: (payload: any, event: { $event: Event, name: string }) => void): MutViewFragment {
        const childIds = this.template.children[id] ?? []
        const children = childIds.map(id => this.renderNode(id, context, emitter))
        const fragment = new MutViewFragment(new MutComputed(() => children))
        return fragment
    }

    renderNode(id: string, context: RenderContext, emitter: (payload: any, event: { $event: Event, name: string }) => void): MutViewNode {
        const node = this.template.values[id]
        try {
            if (!node)
                throw new Error('error node id!')
            if (isMVTemplateRoot(node)) {
                const state: Record<string, MutComputed<unknown>> = node.props
                    .reduce((res, current) => {
                        const val = context.state[current] ?? new MutComputed(() => null)
                        return {
                            ...res, [current]: val
                        }
                    }, {})

                const scope = new RenderContext(
                    this.store, state
                )

                return this.renderChildren(node.id, scope, emitter)
            }

            if (isMVTemplateText(node)) {
                const text = context.val(node.text)
                const vnode = new MutViewText(text)
                return vnode
            }

            if (isMVTemplateElement(node)) {
                const tagName = node.tagName
                const attrs = context.attr(node.attrs)

                const attrMuts = new MutComputed((bind) => {
                    const res: { [key: string]: any } = {};
                    [...Object.entries(attrs)].forEach(([name, list]) => {
                        let val ;
                        list.forEach(element => {
                            if(name === 'class'){
                                val = (val??'') + ' ' + bind(element)
                            }else{
                                val = bind(element)
                            }
                        });
                        res[name] = val
                    })
                    return res
                })


                const events = context.attr(node.events)

                const eventMuts = new MutComputed((bind) => {
                    const res: { [key: string]: any } = {};
                    [...Object.entries(events)].forEach(([name, list]) => {
                        let val;
                        list.forEach(element => {
                            val = bind(element)
                        });
                        res[name] = val
                    })
                    return res
                })
                // const trans = this.attrTransfer.get(id)
                // const tranAttr = trans ? trans(attrs, (ref) => context.val(ref)) : attrs
                const innerHTML = node.innerHTML ? context.val(node.innerHTML) : new MutComputed(() => null)
                const children = this.renderChildren(id, context, emitter)
                const vnode = new MutViewElement(tagName, attrMuts, eventMuts, children, innerHTML)
                vnode.emitter = emitter
                return vnode
            }

            if (isMVTemplateCond(node)) {
                const test = context.val(node.test)
                const render = () => this.renderChildren(id, context, emitter)
                const vnode = new MutViewCondition(test, render)
                return vnode
            }

            if (isMVTemplateLoop(node)) {
                const list = context.val(node.loopValue)
                const render = (val: unknown, idx: number) => this.renderChildren(
                    id, context.extend([
                        { name: node.indexField, value: new MutComputed(() => idx) },
                        { name: node.valueField, value: new MutComputed(() => val) }
                    ]), emitter
                )
                const vnode = new MutViewLoop(list, render)
                return vnode
            }

            if (isMVTemplateContext(node)) {
                const bind = context.val(node.bind)
                const store = this.store
                const newContext = new RenderContext(store, new MutSplit(bind).target)

                return this.renderChildren(node.id, newContext, emitter)
            }

            if (isMVTemplateApply(node)) {
                const rootId = node.rootId
                return this.renderNode(rootId, context, emitter)
            }


        } catch (e) {
            console.error(e)
            console.error(node)
        }
        return new MutViewText(new MutComputed(() => 'ERROR'))
    }

}


export class MutRootFragment extends MutViewFragment {

    constructor(
        readonly list: MutComputed<MutViewNode[]>,
        private readonly context: RenderContext
    ) {
        super(list)

        this.target.onChange = () => {
            if (!this.cntr) return
            this.bind(this.cntr)
        }
    }


    cntr?: HTMLElement | ShadowRoot


    bind(element: HTMLElement  | ShadowRoot)  {
        this.cntr = element
        this.cntr.innerHTML = ''
        this.insertTo(this.cntr)
    }


    insertTo(element: Element| ShadowRoot) {
        this.target.val().forEach(v => {
            v.appendTo(element)
        })
    }
    destroy(): void {
        this.cntr.innerHTML = ''
        this.cntr = undefined
        super.destroy()
        this.context.distroy()
    }

}



