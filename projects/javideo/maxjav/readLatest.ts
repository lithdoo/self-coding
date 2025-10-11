import { writeFileSync } from 'node:fs'
import { connection } from './connection'
import { getBody, WebPageScaner } from '@pkg/scaner/web'
import path from 'node:path'
import { SqliteFileValue } from '@pkg/udatabase/sqlite/connection'


const body = getBody()
const scaner = new WebPageScaner()
const main = async () => {

    const rootUrl = 'https://maxjav.xyz/category/vr/'
    const pageUrl = (pageNo = 0) => {
        if (pageNo === 0) return rootUrl
        return `${rootUrl}page/${pageNo + 1}/`
    }

    let i = -1

    while (true) {
        i = i + 1
        const url = pageUrl(i)
        console.log(url)
        const html = await scaner.read(
            url, 'div#header > div.site_title > h1 > a'
        )

        const list = readList(html)

        await list.reduce(async (res, video_page) => {
            await res
            console.log(video_page)
            const html = await scaner.read(
                video_page.url, 'div#header > div.site_title > h1 > a'
            )

            connection.select('video_page').updateByKey(video_page)

            const { fileItem, video_info } = readDetail(html, video_page.code)

            if (video_info) {
                connection.select('__REF__video_info').updateByKey(video_info)
            }
            writeFileSync(
                path.resolve(__dirname, './.temp/latest', `${new Date().toDateString()}.jsonl`),
                JSON.stringify({ code: fileItem.code, status: fileItem.status }) + '\n',
                { flag: 'a' }
            )

            await new Promise(res => setTimeout(res, 3000))
        }, Promise.resolve())

        await new Promise(res => setTimeout(res, 3000))
    }
}




const readList = (html: string) => {
    body.innerHTML = html

    const list = [...body.querySelectorAll('#content > div.post')]
        .map(v => v.innerHTML)

    return list.map(item_html => {
        body.innerHTML = item_html

        const a = body.querySelector('h2 > a')
        const url = a?.getAttribute('href')
        const code = url?.match(/https\:\/\/maxjav.xyz\/([0-9]*)\//)?.[1]
        const page_update_date = body.querySelector('[rel="bookmark"]')?.textContent

        const data = {
            url,
            code,
            item_html,
            page_update_date,
            update_timestamp: new Date().getTime()
        }
        return data
    })
}


const readDetail = (html: string, code: string) => {
    type FileItem = {
        html: string,
        code: string,
        status: '404' | 'lose-detail' | 'latest' | 'need-update' | 'lose-page'
    }

    let fileItem: FileItem


    // Page-404
    if (html.includes('Error 404 - Not Found')) {
        fileItem = { html, status: '404', code }
        return { fileItem }
    }
    body.innerHTML = html
    const img_url = body.querySelector('.entry img')?.getAttribute('src')
    const page = connection.select('video_page').where({ code }).find()

    // Page-Lose
    if (!page) {
        fileItem = { html, status: 'lose-page', code }
        return { fileItem }
    }
    const update_date = page.data.page_update_date
    const detail = connection.select('__REF__video_info').where({ video_code: code }).find()

    // Update
    if (!detail) {
        fileItem = { html, status: 'lose-detail', code }

        const htmlFile = SqliteFileValue.create(
            connection.metadata,
            'file_path/maxjavr-info-html',
            `${code}.html`
        )
        htmlFile.saveText(html)
        const video_info = {
            video_code: code,
            html: htmlFile,
            html_update_date: update_date,
            img_url: img_url
        }
        return { fileItem, video_info }
    } else if (detail.data.html_update_date === update_date) {
        fileItem = { html, status: 'latest', code }
        return { fileItem }
    } else {
        fileItem = { html, status: 'need-update', code }

        if (detail.data.html) {
            const video_info = { ...detail.data };
            (video_info.html as SqliteFileValue).saveText(html)
            return { fileItem, video_info }
        } else {
            const htmlFile = SqliteFileValue.create(
                connection.metadata,
                'file_path/maxjavr-info-html',
                `${code}.html`
            )
            htmlFile.saveText(html)

            const video_info = {
                video_code: code,
                html: htmlFile,
                html_update_date: update_date,
                img_url: img_url
            }

            return { fileItem, video_info }
        }
    }

}

main()