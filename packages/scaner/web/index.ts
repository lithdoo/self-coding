import { Page } from "playwright"
import { getChromePage, openChrome2, shutdownChrome } from "./playwright"
import { ManualPromise } from "../utils"

export * from './dom'
export * from './sqlite'

export class WebPageScaner {

    static chrome: undefined | Promise<any> = undefined

    page = new ManualPromise<Page>()
    tasks: ScanerTask[] = []
    current?: ScanerTask

    constructor() {
        if (!WebPageScaner.chrome)
            WebPageScaner.chrome = openChrome2()

        this.init()
    }

    shutdown() {
        shutdownChrome()
        WebPageScaner.chrome = undefined
    }

    async init() {
        await WebPageScaner.chrome
        const page = await getChromePage()
        this.page.resolve(page)
    }

    async start() {
        if (this.current) return
        const current = this.tasks.shift()
        if (!current) return
        this.current = current
        await this.deal(current)
        await new Promise(res => setTimeout(res,
            Math.random() * 5 * 1000 + 2000
        ))
        this.current = undefined
        this.start()
    }

    run(task: ScanerTask) {
        this.tasks.push(task)
        this.start()
    }

    read(url: string, waitForSelector?: string) {
        return new Promise<string>((onSuccess, onError) => {
            const task: ScanerTask = {
                url, waitForSelector, onSuccess, onError
            }
            this.run(task)
        })
    }

    private async deal(task: ScanerTask) {
        try {
            // await  new Promise(res => setTimeout(res, 1000 * 2000))
            const page = await this.page.target

            // await Promise.race([
            //     page.goto(task.url, {
            //         timeout: 0
            //     }),
            //     new Promise(res => setTimeout(res, 1000 * 20))
            // ])
            await page.goto(task.url, {
                timeout: 1000 * 60 * 20
            })
            if (task.waitForSelector) {
                await page.waitForSelector(
                    task.waitForSelector,
                    { timeout: 1000 * 60 * 20 }
                )
                const html = await page.locator('body').first().innerHTML()
                task.onSuccess(html)
            }
        } catch (e: any) {
            task.onError(e)
        }

    }
}

export interface ScanerTask {
    url: string
    waitForSelector?: string
    onError(e: Error): void
    onSuccess(html: string): void
}