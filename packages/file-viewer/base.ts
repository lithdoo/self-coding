import { accessSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs"
import path from "path"


export interface FileWithInfo {
    filename: string,
    filepath: string,
    size: number,
    sizeformat: string,
    extname: string,
    title?: string,
    desc?: string,
    tags?: string[]
    extra?: {
        name: string,
        content: string,
        payload: any,
        type: 'text' | 'link' | 'video' | 'shell'
    }[]
}



/**
* 将文件大小（字节数）转换为人类可读的文本格式
* @param bytes 文件大小，以字节为单位
* @param decimals 保留的小数位数，默认为 2
* @returns 格式化后的文件大小文本，如 "1.5 KB"、"2.3 MB" 等
*/
function formatFileSize(bytes: number, decimals: number = 2): string {
    // 处理 0 字节的情况
    if (bytes === 0) return '0 Bytes';

    // 定义单位和转换基数
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    // 计算合适的单位
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    // 格式化并返回结果
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export const readDir = (pathname: string) => {
    const files = readdirSync(pathname)

    const fileSet = new Set(files)

    const infos = files
        .filter(v => !v.endsWith('.fv.json'))
        .map(filename => {
            const filepath = path.resolve(pathname, filename)
            const stat = statSync(filepath)
            // 过滤文件夹
            if (!stat.isFile()) return null
            const size = stat.size
            const sizeformat = formatFileSize(size)
            const extname = path.extname(filename)

            const fvFileName = filename + '.fv.json'
            const fvFilePath = path.resolve(pathname, fvFileName)

            if (!fileSet.has(fvFileName)) {
                return null
            }

            try { accessSync(fvFilePath) } catch (_e) {
                return null
            }

            const fvJson = JSON.parse(
                readFileSync(fvFilePath).toString()
            )

            const result: FileWithInfo = {
                filename,
                filepath,
                size,
                sizeformat,
                extname,
                ...fvJson
            }

            return result

        })
        .filter(v => !!v)

    return infos
}



export const writeInfo = (filePath: string, info: {
    title?: string,
    desc?: string,
    tags?: string[]
    extra?: {
        name: string,
        content: string,
        payload: any,
        type: 'text' | 'link' | 'video' | 'shell' | 'html'
    }[]
}) => {

    try{accessSync(filePath)}catch(e){
        return false
    }

    const fvFilePath = filePath + '.fv.json'

    try {
        writeFileSync(fvFilePath,JSON.stringify(info,null,2))
    }catch(e){
        return false
    }
    return true
}