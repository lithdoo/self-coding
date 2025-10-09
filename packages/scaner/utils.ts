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
