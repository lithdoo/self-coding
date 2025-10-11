import { readdirSync } from "fs"
import url from 'node:url'
import path from "path"
import { connection } from "./connection"
import { isNull, notNull, SqliteFileValue } from "@pkg/udatabase/sqlite/connection"
import { existsSync, writeFileSync } from "node:fs"
import Downloader from "nodejs-file-downloader"

export const readInfoImage = async () => {
    const existList = readdirSync(
        path.resolve(
            __dirname,
            '../../../data-store/.maxjavr_data/maxjavr-info-img'
        )
    )
    const existMap = new Map<string, string>()

    existList.forEach(filename => {
        const code = filename.split('.')[0]
        existMap.set(code, filename)
    })


    const todoList = connection.select('__REF__video_info')
        .where({ img_file: isNull, img_url: notNull })
        .query()

    console.log(todoList.list)

    todoList.list.reduce(async (res, cur) => {
        await res
        const img_url = cur.img_url
        if (!img_url) {
            log({ status: 'error', code: cur.video_code, msg: 'img_url is not exist' })
            return
        }

        const imgUrl = url.parse(img_url)
        if (!imgUrl.pathname || !imgUrl.path) {
            log({ status: 'error', code: cur.video_code, msg: 'img_url_path is not exist' })
            return
        }
        const code = cur.video_code
        const extname = path.extname(imgUrl.pathname)
        const tempDirPath = path.resolve(__dirname, '.temp', `image`)
        const filename = `${code}${extname}`
        const filePath = path.resolve(tempDirPath, filename)
        const host = imgUrl.host
        console.log(`start  
            code:${code} 
            url:${img_url} 
            host:${host} 
            dirPath:${tempDirPath} 
            filename:${filename}`)

        if (extname !== '.jpg' && extname !== '.jpeg' && extname !== '.png') {
            // throw new Error('extname is not jpg')
            log({ status: 'error', code: code, msg: 'extname is not jpg' })
            return
        }


        if (!existsSync(filePath)) {
                console.log('download start;')
            try {
                const downloader = new Downloader({
                    url: img_url, directory: tempDirPath,
                    fileName: filename,
                    timeout: 1000 * 60 * 5
                })
                await downloader.download()
                console.log('download complete;')
            } catch (e: any) {
                console.error('download error;')
                console.error(e)
                log({ status: 'error', code: code, msg: `download error: ${e.message}` })

                return
            }
        }

        const img_file = SqliteFileValue.create(
            connection.metadata,
            'file_path/maxjavr-info-img',
            filename
        )
        console.log(img_file.filePath)
        img_file.copyFile(filePath)
        connection.select('__REF__video_info')
            .updateByKey({
                video_code: code,
                img_url: img_url,
                img_file,
                img_status: 'done'
            })

        if (existsSync(img_file.filePath)) {
            log({ status: 'downloaded', code: code, msg: img_file.filePath })
        }else{
            log({ status: 'error', code: code, msg: `copy error: ${filePath}` })
        }



        // Downloader
    }, Promise.resolve())

}

const log = (status: {
    status: 'downloaded' | 'error',
    code: string,
    msg?: string,
}) => {
    writeFileSync(
        path.resolve(__dirname, './.temp/download', `${new Date().toDateString()}.jsonl`),
        JSON.stringify(status) + '\n',
        { flag: 'a' }
    )

}



readInfoImage()