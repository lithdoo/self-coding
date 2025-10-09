
import { chromium } from 'playwright';
import * as  cp from 'child_process';
import * as path from 'path';


export const shutdownChrome = () => new Promise(res => {
    const e = cp.exec('taskkill /F /IM "chrome.exe"')
    e.on('exit', () => res(null))
})


export const openChrome = () => new Promise(async res => {
    const e = cp.exec(`C:/'Program Files'/Google/Chrome/Application/chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\\Temp\\EdgeProfile"`)
    console.log(`C:\\'Program Files'\\Google\\Chrome\\Application\\chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\\Temp\\EdgeProfile"`)
    e.on('exit', () => res(null))
    return
})

export const openChrome2 = () => new Promise(async (res) => {
    await shutdownChrome()
    const user = path.resolve(__dirname,'ChromeData') || 'C:\\Temp\\EdgeProfile'
    const chrome = cp.spawn(
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        ['--remote-debugging-port=9222', '--user-data-dir='+user],
    );

    setTimeout(()=>{res(null)},5000)
    chrome.on('exit',()=>{res(null)})
})

export const getChromePage = async () => {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    // const defaultContext =await browser.newContext({
    //      storageState: { cookies: [],
    // origins: []},
    // })
    const defaultContext = browser.contexts()[0]
    defaultContext.addInitScript("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})");
    const page = await defaultContext.newPage();
    return page
}


export const waitSec = async (sec: number) => {
    return new Promise<void>((res) => {
        setTimeout(() => {
            res()
        }, sec * 1000)
    })
}
