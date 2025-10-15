import { notNull, SqliteFileValue } from '@pkg/udatabase/sqlite/connection'
import { connection } from './connection'
import { __REF__VIDEO_INFO } from './interface'
import path from 'node:path'
import os from 'node:os'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { readDir, writeInfo } from '@pkg/file-viewer/base'
import { FileViewerRPCServer } from '@pkg/file-viewer/ws'
import { filename2codetype, getAllDownloadCode, getDownloadLink } from './utils/codeDir'



const downloadedCode = getAllDownloadCode()



const getListByFilter = (filter: (v: __REF__VIDEO_INFO, i: number) => boolean) => {

    const all = connection.select('__REF__video_info').where({
        'img_file': notNull,
        'html_update_date': notNull
    }).query()

    return all.list
        .filter((v, i) => filter(v, i))
        .filter((_, i) => i <= 100)
        .sort((a, b) => new Date(b.html_update_date).getTime() - new Date(a.html_update_date).getTime())
}


const clearTemplateDir = () => {
    const tempFilePath = path.resolve(os.tmpdir(), 'list-viewer-' + new Date().toDateString().split(' ').join())
    if (existsSync(tempFilePath)) {
        rmSync(tempFilePath, { recursive: true, force: true })
    }

    mkdirSync(tempFilePath)

    return tempFilePath
}



const searchAndSave = (keyword: string) => {
    const dirPath = clearTemplateDir()
    const list = getListByFilter((v, i) => {
        if ((v.title ?? '').toLocaleLowerCase().includes(keyword)) return true
        if ((v.desc ?? '').toLocaleLowerCase().includes(keyword)) return true
        return false
    })


    list.forEach(item => {

        if (!item.img_file) return null
        const img_file = item.img_file as SqliteFileValue
        const targetPNGPath = path.resolve(dirPath, img_file.filename)
        // cpSync(path.resolve(__dirname, './eg.png'), targetPNGPath)
        // writeFileSync(path.resolve(dirPath, item.video_code + '.json'), '{}')

        const html = (item.html as SqliteFileValue).readText()
        // const links = html.
        const links = getDownloadLink(html)
        const tags = []

        if (!links) {
            tags.push('link: error')
        } else {
            tags.push(`link: ${links.website}`)
            tags.push(`type: ${links.type}`)
            const code = links.files
                .map(v => v.filename)
                .map(v => filename2codetype(v))
                .find(v => !!v)
                ?.code

            if (code) {
                tags.push(`code: ${code}`)
                if (code && downloadedCode.has(code)) {
                    tags.push(`status: downloaded`)
                } else if (code) {
                    tags.push(`status: undownload`)
                }
            }

        }



        if (tags.includes('status: downloaded')) return

        cpSync(img_file.filePath, targetPNGPath)
        console.log(img_file.filePath)

        writeInfo(targetPNGPath, {
            title: item.title,
            desc: item.desc,
            tags,
            extra: links?.files.map(file => ({
                name: links.website,
                content: file.filename,
                payload: file.link,
                type: 'link'
            })) ?? []
        })

    })

    return dirPath
}




const main = () => {

    // const keyword = 'miru'.toLocaleLowerCase()

    const server = new FileViewerRPCServer()

    server.start()


    // setTimeout(() => {
    //     const infos = readDir(searchAndSave(keyword))
    //     server.fileList.updateList(infos)
    // }, 1000 * 10)



    server.onSearchChanged = (text) => {
        console.log('onSearchChanged')
        if (text.trim()) {
            const infos = readDir(searchAndSave(text.trim()))
            server.fileList.updateList(infos)
        } else {
            const infos = []
            server.fileList.updateList(infos)
        }
    }




}


main()