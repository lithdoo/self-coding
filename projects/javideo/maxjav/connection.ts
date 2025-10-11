import { SqliteFileValue, UDBConnection, isNull, notNull } from '@pkg/udatabase/sqlite/connection'
import { StructDef } from './interface'
import path from 'node:path'
import { getBody, WebPageScaner } from '@pkg/scaner/web'
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { Downloader } from "nodejs-file-downloader"
import * as url from "url"
import { select } from '@inquirer/prompts';
import archiver from 'archiver'

export const connection = new class extends UDBConnection<StructDef> {
    constructor() {
        super(path.resolve(__dirname, '../../../data-store/.maxjavr_data/index.db'))
    }

    tempPath = path.resolve(__dirname, './.temp/')

}


export const fetchListPage = async () => {

    const rootUrl = 'https://maxjav.xyz/category/vr/'
    const pageUrl = (pageNo = 0) => {
        if (pageNo === 0) return rootUrl
        return `${rootUrl}page/${pageNo + 1}/`
    }
    const scaner = new WebPageScaner()

    let i = -1

    while (true) {
        i = i + 1
        const url = pageUrl(i)
        console.log(url)
        const html = await scaner.read(
            url, 'div#header > div.site_title > h1 > a'
        )

        writeFileSync(
            path.resolve(connection.tempPath, `list/${i}.html`),
            html
        )

        await new Promise(res => setTimeout(res, 3000))
    }

}


export const readListPage = async () => {
    const dirPath = path.resolve(connection.tempPath, `list`)
    const pageList = readdirSync(dirPath).filter(v => v.includes('.html'))
    const body = getBody()

    const itemHtmlList = pageList.flatMap(pageFileName => {
        const pageFilePath = path.resolve(dirPath, pageFileName)
        const fileContent = readFileSync(pageFilePath).toString()
        body.innerHTML = fileContent
        const list = [...body.querySelectorAll('#content > div.post')]
            .map(v => v.innerHTML)
        return list
    })
    itemHtmlList.forEach(item_html => {
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

        connection.select('video_page').updateByKey(data)
        console.log(data)
    })

}

export const fetchDetailPage = async () => {
    console.log('start fetchDetailPage')
    const dirPath = path.resolve(connection.tempPath, `list`)
    const pageList = readdirSync(dirPath).filter(v => v.includes('.html'))
    const body = getBody()

    const itemHtmlList = pageList.flatMap(pageFileName => {
        const pageFilePath = path.resolve(dirPath, pageFileName)
        const fileContent = readFileSync(pageFilePath).toString()
        body.innerHTML = fileContent
        const list = [...body.querySelectorAll('#content > div.post')]
            .map(v => v.innerHTML)
        return list
    })

    const itemListWithLink = itemHtmlList.map(item_html => {
        body.innerHTML = item_html
        const a = body.querySelector('h2 > a')
        const url = a?.getAttribute('href')
        const code = url?.match(/https\:\/\/maxjav.xyz\/([0-9]*)\//)?.[1]
        return { url, code }
    })

    const detailDirPath = path.resolve(connection.tempPath, './detail')
    if (!existsSync(detailDirPath)) {
        mkdirSync(detailDirPath, { recursive: true })
    }

    const scaner = new WebPageScaner()

    itemListWithLink.reduce(async (res, { code, url }) => {
        await res
        console.log(code)
        console.log(url)
        const filePath = path.resolve(detailDirPath, `${code}.html`)
        if (existsSync(filePath)) return

        const html = await scaner.read(
            url, 'div#header > div.site_title > h1 > a'
        )

        writeFileSync(
            path.resolve(connection.tempPath, filePath),
            html
        )

        await new Promise(res => setTimeout(res, 3000))
    }, Promise.resolve())
}


export const readDetailPage = async () => {
    console.log('start readDetailPage')
    const dirPath = path.resolve(connection.tempPath, `detail`)
    const pageList = readdirSync(dirPath).filter(v => v.includes('.html'))
    const body = getBody()

    console.log(pageList)

    const itemHtmlList: {
        code: string,
        filename: string,
        status: '404' | 'lose-detail' | 'latest' | 'need-update' | 'lose-page'
    }[] = []

    await pageList.reduce(async (res, filename) => {
        await res
        console.log(filename)
        await new Promise(res => setTimeout(res, 10))
        const code = filename.split('.')[0]
        const pageFilePath = path.resolve(dirPath, filename)
        const html = readFileSync(pageFilePath).toString()

        // Page-404
        if (html.includes('Error 404 - Not Found')) {
            itemHtmlList.push({ filename, status: '404', code })
            return
        }
        body.innerHTML = html
        const img_url = body.querySelector('.entry img')?.getAttribute('src')
        const page = connection.select('video_page').where({ code }).find()

        // Page-Lose
        if (!page) {
            itemHtmlList.push({ filename, status: 'lose-page', code })
            return
        }
        const update_date = page.data.page_update_date
        const detail = connection.select('__REF__video_info').where({ video_code: code }).find()

        // Update
        if (!detail) {
            itemHtmlList.push({ filename, status: 'lose-detail', code })

            const htmlFile = SqliteFileValue.create(
                connection.metadata,
                'file_path/maxjavr-info-html',
                `${code}.html`
            )
            htmlFile.saveText(html)
            connection.select('__REF__video_info')
                .updateByKey({
                    video_code: code,
                    html: htmlFile,
                    html_update_date: update_date,
                    img_url: img_url
                })
            return
        } else if (detail.data.html_update_date === update_date) {
            itemHtmlList.push({ filename, status: 'latest', code })
            return
        } else {
            itemHtmlList.push({ filename, status: 'need-update', code })
            if (detail.data.html) {
                (detail.data.html as SqliteFileValue).saveText(html)
                connection.select('__REF__video_info')
                    .updateByKey({
                        video_code: code,
                        html_update_date: update_date,
                        img_url: img_url
                    })
            } else {
                const htmlFile = SqliteFileValue.create(
                    connection.metadata,
                    'file_path/maxjavr-info-html',
                    `${code}.html`
                )
                htmlFile.saveText(html)
                connection.select('__REF__video_info')
                    .updateByKey({
                        video_code: code,
                        html: htmlFile,
                        html_update_date: update_date,
                        img_url: img_url
                    })
            }
            return
        }
    }, Promise.resolve())

    writeFileSync(
        path.resolve(__dirname, '.temp', './404.detail.json'),
        JSON.stringify(itemHtmlList.filter(v => v.status === '404'), null, 2)
    )
    writeFileSync(
        path.resolve(__dirname, '.temp', './lose-detail.detail.json'),
        JSON.stringify(itemHtmlList.filter(v => v.status === 'lose-detail'), null, 2)
    )
    writeFileSync(
        path.resolve(__dirname, '.temp', './latest.json'),
        JSON.stringify(itemHtmlList.filter(v => v.status === 'latest'), null, 2)
    )
    writeFileSync(
        path.resolve(__dirname, '.temp', './need-update.json'),
        JSON.stringify(itemHtmlList.filter(v => v.status === 'need-update'), null, 2)
    )
    writeFileSync(
        path.resolve(__dirname, '.temp', './lose-page.json'),
        JSON.stringify(itemHtmlList.filter(v => v.status === 'lose-page'), null, 2)
    )
}


export const readInfoImage = async () => {
    const existList = readdirSync('D:\\HomeCode\\data-store\\.maxjavr_data\\maxjavr-info-img')
    const existMap = new Map<string, string>()

    existList.forEach(filename => {
        const code = filename.split('.')[0]
        existMap.set(code, filename)
    })


    const todoList = connection.select('__REF__video_info')
        .where({ img_file: isNull, img_url: notNull })
        .query()



    const files: string[] = []

    todoList.list.reduce(async (res, cur) => {
        await res
        const img_url = cur.img_url
        if (!img_url) return

        const imgUrl = url.parse(img_url)
        const code = cur.video_code
        const pathname = imgUrl.path
        const basename = path.basename(imgUrl.pathname)
        const extname = path.extname(imgUrl.pathname)
        const dirname = path.dirname(pathname)
        const dirPath = path.resolve(__dirname, '.temp', `image`)
        const filename = `${code}${extname}`
        const filePath = path.resolve(dirPath, filename)
        const host = imgUrl.host
        console.log(`start  
            code:${code} 
            url:${img_url} 
            host:${host} 
            dirPath:${dirPath} 
            filename:${filename}`)

        if (extname !== '.jpg' && extname !== '.jpeg' && extname !== '.png') {
            throw new Error('extname is not jpg')
        }


        if (!existsSync(filePath)) {
            try {
                const downloader = new Downloader({
                    url: img_url, directory: dirPath,
                    fileName: filename,
                    timeout: 1000 * 60 * 5
                })
                await downloader.download()
                console.log('download complete;')
            } catch (e) {
                console.error('download error;')
                console.error(e)
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

        // Downloader
    }, Promise.resolve())

}


export const readInfoFile = async () => {
    const info = connection
        .select('__REF__video_info')
        .where({ html: notNull })
        .query()
    const fileCode: {
        [key: string]: string[]
    } = {}

    const unsolve = []


    await info.list.reduce(async (res, info) => {
        await res
        await new Promise(r => setTimeout(r, 10))
        const htmlvalue = (info.html as SqliteFileValue)
        const html = htmlvalue?.readText?.()
        const code = info.video_code
        console.log(code)
        if (!html) {
            unsolve.push(code)
            return
        }
        const fileScaner = new VideoFileScaner(html, code)
        console.log(fileScaner.type)
        if (fileScaner.type === VideoFileType.unknown) {
            unsolve.push(code)
        } else {
            fileScaner.files.forEach(({ filename }) => {
                fileCode[filename] = [...new Set([fileScaner.code].concat(fileCode[filename] ?? []))]
            })
        }


    }, Promise.resolve())

    writeFileSync(
        path.resolve(__dirname, './.temp/file2code.json'),
        JSON.stringify({ unsolve, fileCode }, null, 2)
    )
}


export const readDirVideo = async (dir = 'E:\\VR') => {

    const files = readAllFilesRecursively(dir)
    let fileCode: {
        [key: string]: string[]
    } = {}
    let unsolve = []
    const json = JSON.parse(readFileSync(
        path.resolve(__dirname, './.temp/file2code.json')
    ).toString())

    fileCode = json.fileCode
    unsolve = json.unsolve

    const allKeyword = connection.select('keyword').query()
        .list.map(v => v.text)

    const filesWithCode = files.map(file => {
        const codes = fileCode[file.fileName]
        if (!codes || (codes.length > 1)) {
            return { ...file, codes }
        } else {
            const code = codes[0]
            const info = connection.select('__REF__video_info')
                .where({ video_code: code })
                .find()
            if (!info || !info.data.desc || !info.data.title) {
                return { ...file, codes }
            } else {
                const keywords = allKeyword.filter(keyword => {
                    return (
                        info.data.desc.toLocaleLowerCase()
                            .indexOf(keyword.toLocaleLowerCase()) >= 0
                    ) || (
                            info.data.title.toLocaleLowerCase()
                                .indexOf(keyword.toLocaleLowerCase()) >= 0
                        )
                })

                return { ...file, codes, keywords }
            }
        }


    })



    writeFileSync(
        path.resolve(__dirname, './.temp/file_with_code.json'),
        JSON.stringify(filesWithCode, null, 2)
    )
}

const moveTo = (sourcePath: string, targetPath: string) => {
    console.log(`----from: ${sourcePath}`)
    console.log(`    to  : ${targetPath}`)
    const targetDir = path.dirname(targetPath)
    if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true })
    }
    renameSync(sourcePath, targetPath)
}

export const moveDirVideo = (dir = 'E:\\_VR') => {
    const filesWithCode: (FileInfo & {
        keywords?: string[], codes?: []
    })[] = JSON.parse(readFileSync(
        path.resolve(__dirname, './.temp/file_with_code.json')
    ).toString())

    filesWithCode.filter(v => v.keywords?.length === 1)
        .forEach(cur => {
            const [keyword] = cur.keywords ?? []
            if (!keyword) return
            const fileName = cur.fileName
            const codeName = fileName.split('.')[0]
            const reg = /(^[3]?[A-Z|a-z]+(?:4k)?[0-9]*[\-]?[0-9]*)[A-Z]?/
            const match = codeName.match(reg)
            if (!match) return
            console.log(codeName)
            console.log(match[1])
            console.log("------------")
            const dirKey = match[1]
            moveTo(cur.filePath, path.resolve(dir, keyword, dirKey, fileName))
        })
}

export const zipDirVideo = async (dir = 'E:\\_VR') => {

    const keywordDirs = readdirSync(dir, { withFileTypes: true })
        .filter((keywordStat) => { return keywordStat.isDirectory() })
        .filter((keywordStat) => keywordStat.name[0] !== '_')

    let keyword = await select({
        message: 'Select a scipt to run',
        choices: keywordDirs.map(v => ({ value: v.name }))
    })

    const dirs = readdirSync(path.resolve(dir, keyword), { withFileTypes: true })
        .filter((keywordStat) => { return keywordStat.isDirectory() })
        .filter((keywordStat) => keywordStat.name[0] !== '_')

    console.log(dirs.map(v => v.name))

    await dirs.reduce(async (res, cur) => {
        await res
        const dirName = cur.name
        const fileList = readdirSync(path.resolve(dir, keyword, dirName))

        fileList.forEach(filename => {
            writeFileSync(path.resolve(
                __dirname, './.temp', 'download.jsonl'
            ), JSON.stringify({filename,keyword}) + '\n', { flag: 'a' })
        })
        await zipDir(
            path.resolve(dir, keyword, dirName),
            path.resolve(dir, '_zip', keyword, `${dirName}.zip`)
        )
    }, Promise.resolve())

}

// const todo = '\\\\N2\\Users\\lithd\\Downloads\\C_DOWNLOAD'
// readDirVideo(todo)
//     .then(()=>moveDirVideo(todo))
//     .then(()=>zipDirVideo(todo))

// zipDirVideo()
    ; (() => {

        // const entries = readdirSync('\\\\n2\\同步文件\\ScanVR\\_115', { withFileTypes: true })

        // const actorList = {

        // }

        // entries.forEach(entry => {
        //     if (!entry.isDirectory()) return
        //     const fullPath = path.join('\\\\n2\\同步文件\\ScanVR\\_115', entry.name);
        //     const dirList = readdirSync(fullPath, { withFileTypes: true })
        //     dirList.forEach(dir => {
        //         if (!dir.isDirectory()) return
        //         let idx = 999
        //         if (entry.name === 'fans') idx = 1001

        //         const cur = connection.select('keyword').where({text:dir.name}).find()

        //         if(!cur || !cur.data.idx || (cur.data.idx < idx)){
        //             connection.select('keyword').updateByKey({
        //                 text:dir.name,
        //                 idx,
        //                 type:'actor',
        //                 update_timestamp: new Date().getTime()
        //             })
        //         }

        //         console.log(dir.name + ' ' + idx)
        //     })
        // })
    })()

// readInfoImage()
// readInfoFile()
// readDetailPage()
// 蘭々
// 美園和花
// 日向なつ
// 堀田真央


enum VideoFileType {
    VR8K = '8k',
    VR4K = '4k',
    VR = 'vr',
    LR = 'lr',
    unknown = 'unknown',
}
class VideoFileScaner {
    static body = getBody()
    type: VideoFileType
    files: { link: string; filename: string; }[]

    constructor(public html: string, public code: string) {
        const cntr = VideoFileScaner.body
        cntr.innerHTML = html

        const links = Array.from(cntr.querySelectorAll('a'))
            .filter(v =>
                v.href.toLocaleLowerCase().includes('https://fikper.com')
                || v.href.toLocaleLowerCase().includes('https://uploadgig.com')
                || v.href.toLocaleLowerCase().includes('https://tezfiles.com'))
            .map(v => ({
                link: v.href,
                filename: v.href.split('/').reverse()[0]
            }))

        const typeList: [VideoFileType, (name: string) => boolean][] = [
            [VideoFileType.VR8K, (filename) => filename.toLocaleLowerCase().includes('8k.mp4')],
            [VideoFileType.VR4K, (filename) => filename.toLocaleLowerCase().includes('4k.mp4')],
            [VideoFileType.VR4K, (filename) => filename.toLocaleLowerCase().includes('3k.mp4')],
            [VideoFileType.VR, (filename) => filename.toLocaleLowerCase().includes('vr.mp4')],
            [VideoFileType.LR, (filename) => filename.toLocaleLowerCase().includes('lr.mp4')],
            [VideoFileType.unknown, (_) => true],
        ]

        const type = typeList.find(type => links.find(v => type[1](v.filename)))
        this.type = type[0] ?? VideoFileType.unknown
        if (this.type === VideoFileType.unknown) {
            this.files = []
        } else {
            this.files = links.filter(v => type[1](v.filename)).filter(v => v.filename !== 'register')
        }

    }
}

// 定义返回的文件信息类型
interface FileInfo {
    filePath: string;    // 文件完整路径
    fileName: string;    // 文件名（包含扩展名）
    fileSize: number;    // 文件大小（字节）
}
/**
 * 递归读取指定路径下的所有文件信息
 * @param dirPath 要读取的目录路径
 * @returns 包含所有文件信息的数组
 */
function readAllFilesRecursively(dirPath: string): FileInfo[] {
    const fileInfos: FileInfo[] = [];

    try {
        // 读取目录内容
        const entries = readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (entry.isDirectory() && entry.name === 'node_modules') {

            } else if (entry.isDirectory()) {
                // 如果是目录，递归处理
                const subDirFiles = readAllFilesRecursively(fullPath);
                fileInfos.push(...subDirFiles);
            } else if (entry.isFile()) {
                // 如果是文件，获取文件信息
                const stats = statSync(fullPath);
                fileInfos.push({
                    filePath: fullPath,
                    fileName: entry.name,
                    fileSize: stats.size
                });
            }
        }

        return fileInfos;
    } catch (error) {
        console.error(`读取目录 ${dirPath} 时发生错误:`, error);
        throw error; // 重新抛出错误以便调用者处理
    }
}


function zipDir(sourceDirPath: string, targetFilePath: string) {
    console.log('start    : ' + sourceDirPath)
    return new Promise<void>(async (res, rej) => {

        const targetDir = path.dirname(targetFilePath)
        mkdirSync(targetDir, { recursive: true })

        // 2. 创建输出流
        const output = createWriteStream(targetFilePath);

        // 3. 创建 archiver 实例并配置加密选项
        const archive = archiver('zip-encrypted', {
            zlib: { level: 9 }, // 可选：压缩级别 (1-9)
            encryptionMethod: 'aes256', // 加密方法：'aes256' 或 'zip20'（传统加密）:cite[3]
            password: 'tempcode' // 请务必设置一个强密码
        });

        // 4. 监听事件
        output.on('close', () => {
            console.log(`complete : ${targetFilePath} 加密压缩完成！总共压缩了 ${archive.pointer()} 字节。`);
            res()
        });

        archive.on('error', (err) => {
            rej(err)
        });

        // 5. 建立管道并添加目录
        archive.pipe(output);
        archive.directory(sourceDirPath, false); // 第二个参数 false 表示不在压缩包内创建顶层文件夹
        // 如需将文件夹内容放入压缩包内的某个子目录，可以这样写：
        // archive.directory('要压缩的文件夹的路径/', '压缩包内子目录名'); 

        // 6. 最终化
        archive.finalize();
    })

}