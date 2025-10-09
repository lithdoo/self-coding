
import { type RefStore, type TemplateTree, type GlobalDeclare, type InjectCSS } from '../render'
import { MVTemplateComponentType, type MVTemplateRoot } from '../template';

import { WarpedAttr, WarpedElement, type ParseMod, type XMLParserContext } from './base';
import { modBem, modFlow, modRef, modTag, modText } from './mods';
// import { MutVal } from '../base/mut';


export class XMLParserTask implements XMLParserContext {
    static domParser = new DOMParser();
    static mods: ParseMod[] = [
        modFlow,
        modRef,
        modTag,
        modText,
        modBem,
    ]
    root: HTMLElement

    mods: Map<string, ParseMod> = new Map()
    store: RefStore = { values: {} }
    template: TemplateTree = { values: {}, children: {} }
    global: GlobalDeclare = { components: {} }
    css: InjectCSS = { values: {} }

    constructor(
        public xml: string,
    ) {
        const xmlDoc = XMLParserTask.domParser.parseFromString(xml, "text/xml");
        this.root = xmlDoc.documentElement
        this.dealRoot()

    }

    dealRoot() {
        const attrs = this.root.getAttributeNames()
        attrs.filter(v => v.includes('xmlns:'))
            .map(name => [name.replace('xmlns:', ''), this.root.getAttribute(name)])
            .reduce((res, [name, value]) => {
                const mod = XMLParserTask.mods.find(mod => mod.key === value)
                if (mod && name) res.set(name, mod)
                return res
            }, this.mods)

        const declares = [...this.root.children]
            .filter(v => v.tagName === 'declare')

        const rootNodes = [...this.root.children]
            .filter(v => v.tagName !== 'declare')

        declares.map<[Element[], string]>(declare => [[...declare.children], this.dealDeclare(declare)])
            .forEach(([children, pid]) => {
                children.forEach((child: Element) => {
                    this.dealElement(pid, child)
                })
            })

        rootNodes.forEach(node => {
            this.dealElement('', node)
        })

        this.logTemplate()
    }

    dealDeclare(element: Element) {
        const name = element.getAttribute('name')
        if (!name) throw new Error()
        if (this.global.components[name]) throw new Error()

        const template: MVTemplateRoot = {
            id: Math.random().toString(),
            type: MVTemplateComponentType.Root,
            isLeaf: false,
            props: (element.getAttribute('props') ?? '')
                .split(',')
                .map(v => v.trim())
                .filter(v => !!v)
        }

        this.global.components[name] = {
            rootId: template.id,
        }
        this.template.values[template.id] = template;
        return template.id
    }

    dealElement(pid: string, element: Element) {
        const [modName] = element.tagName.split(':')
            .map(v => v.trim())
        const mod = this.mods.get(modName)
        if (!mod) return
        const warped = new WarpedElement(element)
        mod.dealElement?.({
            pid, element: warped, context: this,
            next: (pid: string, children?: WarpedElement[]) => {
                let childrenElement = children ?? warped.children()
                childrenElement.forEach(child => this.dealElement(pid, child.target))
                element.getAttributeNames()
                    .map((name) => {
                        return new WarpedAttr(name, element.getAttribute(name) ?? '')
                    })
                    .filter(attr => {
                        return !!attr.namespace
                    })
                    .forEach(attr => {
                        const mod = this.mods.get(attr.namespace)
                        if (!mod) return
                        mod.dealAttr?.({
                            id: pid,
                            attr,
                            context: this
                        })
                    })
            }
        })


    }

    logTemplate() {
        Object.entries(this.global.components).forEach(([name, option]) => {
            // console.log(`-----component: ${name}-----`)
            const { rootId } = option
            const log = (id: string, level = 0) => {
                const template = this.template.values[id]
                // console.log(`|${new Array(level).fill('-').join('')}${template.type}`)
                const children = this.template.children[id]
                if (children) {
                    children.forEach(id => log(id, level + 1))
                }
            }
            log(rootId)
        })
    }
}

// export const test = new XMLParserTask(xmlString)

// const element = new MVRenderer(test)
//     .renderRoot('render-node', new MutVal({
//         entity: {
//             id: Math.random().toString(),
//             name: 'test_table_node 1',
//             desc: '',
//             fields: new Array(Math.floor(Math.random() * 10 + 1))
//                 .fill(0)
//                 .map((_, idx) => ({
//                     name: `field ${idx}`,
//                     type: 'type',
//                     desc: ''
//                 }))
//         }
//     }))


