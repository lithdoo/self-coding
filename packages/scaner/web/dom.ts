import { JSDOM } from 'jsdom'

export const getBody = () => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
    const document = dom.window.document
    const body = document.querySelector('body')
    return body as HTMLBodyElement 
}