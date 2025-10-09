import { existsSync, appendFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import fs from 'node:fs'


export const accessFile = (filePath: string) => {
    try {
        fs.accessSync(filePath)
        return fs.statSync(filePath).isFile()
    } catch (e) {
        return false
    }
}
export const fconsole = new class {
    filePath = path.resolve(__dirname, '../../javlib.log')
    log(text: string) {
        console.log(text)
        if (existsSync(this.filePath)) {
            appendFileSync(this.filePath, '\r\n')
            appendFileSync(this.filePath, `${new Date().toTimeString()} - ${text}`)
        } else {
            writeFileSync(this.filePath, `${new Date().toTimeString()} - ${text}`)
        }
    }
}


export class ManualPromise<T> {
    target: Promise<T>
    done: boolean = false
    reject: (e: Error) => void = null as any
    resolve: (val: T) => void = null as any
    constructor() {
        this.target = new Promise((res, rej) => {
            this.reject = (val) => {
                this.done = true
                rej(val)
            }

            this.resolve = (val) => {
                this.done = true
                res(val)
            }
        })
    }
}
