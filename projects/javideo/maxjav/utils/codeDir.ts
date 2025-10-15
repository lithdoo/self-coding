import { readdirSync, readFileSync } from "node:fs"
import { connection } from "../connection"
import path from "node:path"
import { readDir } from "@pkg/file-viewer/base"
import { getBody } from "@pkg/scaner/web"


export const filename2codetype = (file: string) => {

    const reg = /(^[3]?[A-Z|a-z]+(?:4k)?[0-9]*[\-]?[0-9]*)[A-Z].(VR.rar|VR.mp4|MR.mp4|8K.mp4|4K.mp4|2K.mp4|LR.mp4|H265.mp4|H264.mp4|GearVR.mp4|VR.mkv|3K.mp4|mp4|mkv)$/
    const match = file.toString().match(reg)
    const reg2 = /(^[3]?[A-Z|a-z]+(?:4k)?[0-9]*[\-]?[0-9]*).(VR.rar|MR.mp4|VR.mp4|8K.mp4|4K.mp4|2K.mp4|LR.mp4|H265.mp4|H264.mp4|GearVR.mp4|VR.mkv|3K.mp4|UMR.mp4|mp4|mkv)$/
    const match2 = file.toString().match(reg2)

    if (match) {
        const [filename, code, type] = match

        return {
            filename, code, type
        }
    } else if (match2) {
        const [filename, code, type] = match2
        return {
            filename, code, type
        }
    }

    console.error('code parse error: ' + file + '')

    return null

}



export const getAllDownloadCode = () => {



    const downloaded = new Set()

    // 处理 .temp
    readFileSync(path.resolve(__dirname, '../.temp/download.jsonl'))
        .toString()
        .split('\n')
        .filter(v => !!v)
        .map(v => JSON.parse(v))
        .forEach(v => {
            const filename = v.filename
            // const keyword = v.keyword

            const codeType = filename2codetype(filename)
            if (!codeType) {
                console.error('error parse codeDir :' + filename)
            } else {
                downloaded.add(codeType.code)
            }
        })

    // 处理 connection
    connection.select('download_file').query()
        .list.forEach(v => {
            downloaded.add(v.code_dir)
        })

    // 处理目录树
    const dirPath = path.resolve(__dirname, '../.temp/目录树/')
    const list = readdirSync(dirPath)
    const files = list.flatMap(file => {
        return readFileSync(path.resolve(dirPath, file))
            .toString('utf16le')
            .split('\n')
            .filter(v => !!v)
            .filter(v => v.includes('.'))
            .map(v => v
                .replaceAll('-', '')
                .replaceAll('|', '')
                .replaceAll('\t', '')
                .replaceAll(' ', '')
                .replaceAll('\r', '')
                .replaceAll('\n', '')
                .replaceAll('\f', '')
                .replaceAll('\v', '')
            )
            .map(v => v.trim())
            .map(v => filename2codetype(v))
            .filter(v => !!v)
    })

    files.forEach(v => downloaded.add(v.code))

    console.log(downloaded.size)

    return downloaded
}

const cntr = getBody()
export const getDownloadLink = (detail: string) => {
    cntr.innerHTML = detail

    const links = Array.from(cntr.querySelectorAll('a'))
        .filter(v =>
            v.href.toLocaleLowerCase().includes('https://fikper.com')
            || v.href.toLocaleLowerCase().includes('https://uploadgig.com')
            || v.href.toLocaleLowerCase().includes('https://tezfiles.com'))
        .map(v => ({
            link: v.href,
            filename: v.href.split('/').reverse()[0]
        }))

    const typeList: [string, (name: string) => boolean][] = [
        ['8k', (filename) => filename.toLocaleLowerCase().includes('8k.mp4')],
        ['4k', (filename) => filename.toLocaleLowerCase().includes('4k.mp4')],
        ['4k', (filename) => filename.toLocaleLowerCase().includes('3k.mp4')],
        ['vr', (filename) => filename.toLocaleLowerCase().includes('vr.mp4')],
        ['lr', (filename) => filename.toLocaleLowerCase().includes('lr.mp4')],
        ['unknown', (_) => true],
    ]

    const type = typeList.find(type => links.find(v => type[1](v.filename)))
    if (!type) {
        links.forEach(v => console.log(v.link))
        // throw new Error('type find error')
        return null
    }

    const website = links[0].link.toLocaleLowerCase().includes('https://fikper.com') ? 'fikper'
        : links[0].link.toLocaleLowerCase().includes('https://uploadgig.com') ? 'uploadgig'
            : links[0].link.toLocaleLowerCase().includes('https://tezfiles.com') ? 'tezfiles'
                : 'unknown'


    return {
        type: type[0],
        website,
        files: links.filter(v => type[1](v.filename)).filter(v => v.filename !== 'register')
    }
}