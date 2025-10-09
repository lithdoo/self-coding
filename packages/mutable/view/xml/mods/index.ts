import type { EvalVal } from "../../eval"
import {
    MVTemplateComponentType, type MVTemplateElement, MVTemplateHtmlType,
    type MVTemplateContext, type MVTemplateApply, type MVTemplateText,
    type MVTemplateLoop, MVTemplateFlowType, isMVTemplateElement
} from "../../template"
import { WarpedElement, type ParseMod, type WarpedAttr, type XMLParserContext } from "../base"

export const modTag = new class implements ParseMod {
    key = "tag"

    templates = new Map<string, MVTemplateElement>()

    dealElement(option: {
        pid: string,
        element: WarpedElement,
        context: XMLParserContext,
        next: (id: string) => void
    }) {


        const { element, context: task, pid, next } = option

        if (element.name === 'bind' && element.attr('on')) {

            const event = element.attr('on')
            const template = this.templates.get(pid)
            if (!template) return
            if (!event) return

            const value: EvalVal = {
                type: 'eval:js',
                content: element.textContent()
            }
            const ref = Object.entries(task.store.values)
                .find(([_key, val]) => {
                    return value.type === val.type && value.content === val.content
                })?.[0]
            const refKey = ref ?? Math.random().toString()
            task.store.values[refKey] = value
            template.events = template.events
                .filter(v => v.name !== event)
                .concat([{ name: event, value: { '_VALUE_GENERATOR_REFERENCE_': refKey } }])

        } else if (element.name === 'bind' && element.attr('attr')) {

            const attr = element.attr('attr')
            const template = this.templates.get(pid)
            if (!template) return
            if (!attr) return

            const value: EvalVal = {
                type: 'eval:js',
                content: element.textContent()
            }
            const ref = Object.entries(task.store.values)
                .find(([_key, val]) => {
                    return value.type === val.type && value.content === val.content
                })?.[0]
            const refKey = ref ?? Math.random().toString()
            task.store.values[refKey] = value
            template.attrs = template.attrs
                .filter(v => v.name !== attr)
                .concat([{ name: attr, value: { '_VALUE_GENERATOR_REFERENCE_': refKey } }])

        } else {
            const tagName = element.name
            const template: MVTemplateElement = {
                id: Math.random().toString(),
                type: MVTemplateHtmlType.Element,
                isLeaf: false,
                tagName,
                attrs: [], // todo
                events: [], // todo
            }

            task.template.children[pid] = (
                task.template.children[pid] ?? []
            ).concat([template.id])
            this.templates.set(template.id, template)
            task.template.values[template.id] = template
            next(template.id)
        }

    }
}


export const modRef = new class implements ParseMod {
    key = "ref"

    dealElement(option: {
        pid: string,
        element: WarpedElement,
        context: XMLParserContext,
        next: (id: string) => void
    }) {
        const { element, context: task, pid, next } = option
        const componentName = element.name


        const bind = element.attr('bind') ?? "{}"
        const value: EvalVal = {
            type: 'eval:js',
            content: `return ${bind}`
        }

        const ref = Object.entries(task.store.values)
            .find(([_key, val]) => {
                return value.type === val.type && value.content === val.content
            })?.[0]

        const refKey = ref ?? Math.random().toString()

        task.store.values[refKey] = value

        const templateContext: MVTemplateContext = {
            id: Math.random().toString(),
            type: MVTemplateComponentType.Context,
            isLeaf: false,
            bind: { '_VALUE_GENERATOR_REFERENCE_': refKey }
        }

        const templateApply: MVTemplateApply = {
            id: Math.random().toString(),
            type: MVTemplateComponentType.Apply,
            isLeaf: true,
            rootId: task.global.components[componentName].rootId
        }


        task.template.children[pid] = (
            task.template.children[pid] ?? []
        ).concat([templateContext.id])

        task.template.children[templateContext.id] = (
            task.template.children[templateContext.id] ?? []
        ).concat([templateApply.id])

        task.template.values[templateContext.id] = templateContext
        task.template.values[templateApply.id] = templateApply

        next(templateApply.id)
    }
}


export const modText = new class implements ParseMod {
    key = 'text'

    dealElement(option: { pid: string; element: WarpedElement; context: XMLParserContext; next: (id: string) => void; }): void {
        const { element, context, pid, next } = option
        const type = element.name
        if (type === 'js') {

            const value: EvalVal = {
                type: 'eval:js',
                content: element.textContent()
            }

            const ref = Object.entries(context.store.values)
                .find(([_key, val]) => {
                    return value.type === val.type && value.content === val.content
                })?.[0]
            const refKey = ref ?? Math.random().toString()

            context.store.values[refKey] = value

            const template: MVTemplateText = {
                id: Math.random().toString(),
                type: MVTemplateHtmlType.Text,
                text: { '_VALUE_GENERATOR_REFERENCE_': refKey },
                isLeaf: true,
            }

            context.template.children[pid] = (
                context.template.children[pid] ?? []
            ).concat([template.id])

            context.template.values[template.id] = template
        } else {
            throw new Error()
        }

    }
}

export const modFlow = new class implements ParseMod {
    key = 'flow'



    dealElement(option: { pid: string; element: WarpedElement; context: XMLParserContext; next: (id: string) => void; }): void {
        const { element, context, pid, next } = option
        if (element.name === 'loop') {
            const valueField = element.attr('value') ?? '__value__'
            const indexField = element.attr('index') ?? '__index__'


            const value: EvalVal = {
                type: 'eval:js',
                content: `return ${element.attr('js') ?? "[]"}`
            }

            const ref = Object.entries(context.store.values)
                .find(([_key, val]) => {
                    return value.type === val.type && value.content === val.content
                })?.[0]
            const refKey = ref ?? Math.random().toString()
            context.store.values[refKey] = value

            const template: MVTemplateLoop = {
                id: Math.random().toString(),
                type: MVTemplateFlowType.Loop,
                valueField,
                loopValue: { '_VALUE_GENERATOR_REFERENCE_': refKey },
                indexField,
                isLeaf: false,
            }


            context.template.children[pid] = (
                context.template.children[pid] ?? []
            ).concat([template.id])

            context.template.values[template.id] = template

            next(template.id)
        }
    }
}


export const modBem = new class implements ParseMod {
    key = "bem"
    dealAttr(option: {
        id: string,
        attr: WarpedAttr,
        context: XMLParserContext
    }) {
        const { id, attr, context } = option
        const name = attr.name.split('.')
        let className = name[0] ?? ''
        if (name[1]) className = `${className}__${name[1]}`
        if (name[2]) className = `${className}--${name[2]}`

        const template = context.template.values[id]
        if (isMVTemplateElement(template)) {
            const value: EvalVal = {
                type: 'eval:js', content: `
                    const s = ${attr.value ?? 'true'};
                    return (!!s) ? "${className}": ""
                `
            }
            const ref = Object.entries(context.store.values)
                .find(([_key, val]) => {
                    return value.type === val.type && value.content === val.content
                })?.[0]
            const refKey = ref ?? Math.random().toString()
            context.store.values[refKey] = value
            template.attrs = [
                ...template.attrs,
                { name: 'class', value: { "_VALUE_GENERATOR_REFERENCE_": refKey } }
            ]
        }
    }

    dealElement(option: {
        pid: string;
        element: WarpedElement;
        context: XMLParserContext;
        next: (id: string, children?: WarpedElement[]) => void
    }
    ): void {
        const { pid, element, next, context } = option
        if (element.name === 'block') {
            const blockName = element.attr('name')
            if (!blockName) return

            const css: WarpedElement[] = []
            const find = (element: WarpedElement, upper: string = '') => {
                if (element.name === 'css' && element.namespace === 'bem') {
                    let className = blockName
                    if (upper) className = `${className}__${upper}`
                    const mod = element.attr('mod')
                    if (mod) className = `${className}--${mod}`
                    element.target.setAttribute('class', className)
                    css.push(element)
                } else if (!element.namespace) {
                    const current = element.name
                    element.children().forEach(child => find(child, current))
                }
            }

            element.children().forEach(child => find(child))
            next(pid, css)
        }

        if (element.name === 'css') {
            const id = Math.random().toString()
            const className = element.attr('class') ?? ''
            const textContent = element.textContent() ?? ''
            if (!className || !textContent) return

            const content = this.replace(textContent, className)
            context.css.values[id] = { id, content }
        }

    }

    replace(cssText: string, className: string) {
        return cssText.replace(/([^{]+?)(\s*\{)/g, (_match, selectors, rest) => {
            const replacedSelectors = selectors.replace(/&/g, `.${className}`);
            return replacedSelectors + rest;
        });
    }

}


