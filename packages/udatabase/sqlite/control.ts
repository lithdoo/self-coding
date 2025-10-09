import path from "path"
import { BaseType, type ExtType, isNull, notNull, type RelationData, type StructData, type TypeDeal, type UDBController } from "../base"
import { accessFile } from "../utils"
import { readFileSync, writeFileSync } from "fs"
import * as url from 'url'
import BetterSqlite3 from 'better-sqlite3'
import { ManualPromise } from '../utils'
import { createDBFile, createTsFile } from "./utils"



export class SqliteConnection {
    static raw(filePath: string) {
        return new BetterSqlite3(filePath)
    }
    db: BetterSqlite3.Database
    open: ManualPromise<void> = new ManualPromise()
    constructor(
        public fileUrl: string
    ) {
        const filePath = url.fileURLToPath(fileUrl)
        this.db = new BetterSqlite3(filePath)
    }

    query: Map<string, BetterSqlite3.Statement> = new Map()
    prepare(name: string, sql: string) {
        const prepare = this.query.get(name)
        if (prepare) return prepare
        try {
            const newPrepare = this.db.prepare(sql)
            this.query.set(name, newPrepare)
            return newPrepare
        } catch (e) {
            console.log('prepare error: \r\n' + sql)
            throw e
        }
    }

}


export const sqliteBaseTypeDeal: TypeDeal<UDBSqliteController> = {
    use: (keyName: string) => {
        return Object.values(BaseType).includes(keyName as any)
    },

    toSave(source) {
        return source
    },

    fromeSave(source) {
        return source
    }
}

export const sqliteFileTypeDeal: TypeDeal<UDBSqliteController> = {
    use: (_: string, meta: any) => {
        return meta?.type === 'file_path'
    },

    toSave(source: SqliteFileValue | null) {
        return source?.value ?? null
    },

    fromeSave(source: any, option: any) {
        if (source) {
            return new SqliteFileValue(
                option.controller,
                option.type,
                source as string
            )
        } else {
            return null
        }

    }
}



export type SqliteDatabase = BetterSqlite3.Database


export class UDBSqliteController implements UDBController {
    typeMeta: { [key: string]: unknown } = {}
    structs: StructData[] = []
    relations: RelationData[] = []
    db: SqliteDatabase
    constructor(
        public dbPath: string,
    ) {
        this.init()
        this.db = SqliteConnection.raw(this.dbPath)
    }

    get dirPath(): string {
        return path.dirname(this.dbPath)
    }


    createNewDBFile() {
        createDBFile(this.dirPath, this)
    }

    createTsFile(dir: string) {
        createTsFile(dir, this)
    }


    relativePath(...to: string[]) {
        return path.resolve(this.dirPath, ...to)
    }

    init() {
        if (accessFile(this.relativePath('./ext_type.json'))) {
            const list = JSON.parse(readFileSync(this.relativePath('./ext_type.json')).toString())
            this.typeMeta = list
        }


        if (accessFile(this.relativePath('./struct.json'))) {
            const list = JSON.parse(readFileSync(this.relativePath('./struct.json')).toString())
            this.structs = list
        }


        if (accessFile(this.relativePath('./relation.json'))) {
            const list = JSON.parse(readFileSync(this.relativePath('./relation.json')).toString())
            this.relations = list
        }
    }

    async find<T = any>(keyName: string, part: { [P in keyof T]?: T[P] | Symbol; } = {}): Promise<T | null> {
        const model = [...this.structs, ...this.relations].find(v => v.keyName === keyName)
        if (!model) throw new Error()
        const val = this.dealParamsObj(part, model)
        const params: any = {}
        const where = Array.from(Object.entries(val)).map(([name, value]) => {
            if (value === isNull)
                return ` ${name} is null `
            else if (value === notNull)
                return ` ${name} not null `
            else {
                params[name] = value
                return ` ${name} = @${name} `
            }
        }).join(' and ')
        return this.get(keyName, where, params)
    }

    async query<T = any>(keyName: string, part: { [P in keyof T]?: T[P] | Symbol; } = {}): Promise<T[]> {
        const model = [...this.structs, ...this.relations].find(v => v.keyName === keyName)
        if (!model) throw new Error()
        const val = this.dealParamsObj(part, model)
        const params: any = {}
        const where = Array.from(Object.entries(val)).map(([name, value]) => {
            if (value === isNull)
                return ` ${name} is null `
            else if (value === notNull)
                return ` ${name} not null `
            else {
                params[name] = value
                return ` ${name} = @${name} `
            }
        }).join(' and ')
        return this.all(keyName, where, params)
    }

    async remove<T = any>(keyName: string, part: { [P in keyof T]?: T[P] | Symbol; } = {}): Promise<void> {
        const model = [...this.structs, ...this.relations].find(v => v.keyName === keyName)
        if (!model) throw new Error()
        const val = this.dealParamsObj(part, model)
        const params: any = {}
        const where = Array.from(Object.entries(val)).map(([name, value]) => {
            if (value === isNull)
                return ` ${name} is null `
            else if (value === notNull)
                return ` ${name} not null `
            else {
                params[name] = value
                return ` ${name} = @${name} `
            }
        }).join(' and ')
        await this.del(keyName, where, params)
    }

    async insert<T = any>(keyName: string, data: T): Promise<void> {
        const model = [...this.structs, ...this.relations].find(v => v.keyName === keyName)
        if (!model) throw new Error()
        const val = this.dealResObj(data, model)
        const keys = [...Object.keys(val)]
        const state = this.db.prepare(`
            INSERT INTO ${keyName} (${keys.join(', ')})
            VALUES (${keys.map(v => `@${v}`).join(', ')})
            RETURNING *
        `)

        state.run(val)
    }

    async updateByKey<T = any>(keyName: string, data: Partial<T>, autoInsert: boolean = true) {
        const model = [...this.structs, ...this.relations].find(v => v.keyName === keyName)
        if (!model) throw new Error()
        const val = this.dealResObj(data, model)
        const keyFields = (model as StructData).keyField
            ? [(model as StructData).keyField]
            : (model as RelationData).relations.map(v => v.field)

        const keyPart = keyFields
            .map(name => ({ name, value: val[name] }))
            .reduce((res, current) => ({ ...res, [current.name]: current.value }), {})

        const exist = await this.find(keyName, keyPart)
        if (exist) {
            const dataKeys = [...Object.keys(val)].filter(v => !keyFields.includes(v))
            if (!dataKeys.length) throw new Error()
            const state = this.db.prepare(`
                    update ${keyName} 
                    set ${dataKeys.map(n => `${n} = @${n}`).join(', ')}
                    where ${keyFields.map(n => `${n} = @${n}`).join(' and ')}
                `)
            state.run(val)
        } else if (autoInsert) {
            return await this.insert(keyName, data)
        } else {
            throw new Error('target value not exist')
        }
    }

    async findWith<S = any, T = any>(
        source: { name: string, field: string, params?: { [P in keyof T]?: T[P] | Symbol; } },
        target: { name: string, field: string, params?: { [P in keyof S]?: S[P] | Symbol; } },
    ): Promise<T | null> {

        const sModel = [...this.structs, ...this.relations].find(v => v.keyName === source.name)
        const tModel = [...this.structs, ...this.relations].find(v => v.keyName === target.name)
        if (!sModel || !tModel) throw new Error()
        const sField = sModel.fields.find(v => v.name === source.field)
        const tField = tModel.fields.find(v => v.name === target.field)
        if (!sField || !tField) throw new Error()


        const where: string[] = []
        const params: any = {}
        const field = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k']
        if (source.params) {
            const paramsArr = Array.from(Object.entries(this.dealParamsObj(source.params, sModel)))
            where.push(
                paramsArr.map(([name, value]) => {
                    if (value === isNull)
                        return ` s.${name} is null `
                    else if (value === notNull)
                        return ` s.${name} not null `
                    else {
                        const f = field.pop()
                        if (!f) throw new Error()
                        params[f] = value
                        return ` s.${name} = @${f} `
                    }
                }).join(' and ')
            )
        }
        if (target.params) {
            const paramsArr = Array.from(Object.entries(this.dealParamsObj(target.params, sModel)))
            where.push(
                paramsArr.map(([name, value]) => {
                    if (value === isNull)
                        return ` t.${name} is null `
                    else if (value === notNull)
                        return ` t.${name} not null `
                    else {
                        const f = field.pop()
                        if (!f) throw new Error()
                        params[f] = value
                        return ` t.${name} = @${f} `
                    }
                }).join(' and ')
            )
        }


        return (await this.join(
            [source.name, source.field, 's'],
            [target.name, target.field, 't'],
            where.length ? where.join(' and ') : null
        )).get(params) as any

    }

    private async get(keyName: string, where?: string, ...params: any[]): Promise<any | null> {
        const model = [...this.structs, ...this.relations].find(v => v.keyName === keyName)
        if (!model) throw new Error()
        const raw = this.db.prepare(`select * from ${model.keyName} ${where ? `where ${where}` : ''};`).get(...params)
        return raw && this.dealRawObj(raw, model)
    }

    private async all(keyName: string, where?: string, ...params: any[]): Promise<any[]> {
        const model = [...this.structs, ...this.relations].find(v => v.keyName === keyName)
        if (!model) throw new Error()
        const rawList = this.db.prepare(`select * from ${model.keyName} ${where ? `where ${where}` : ''};`).all(...params)
        return rawList.map(raw => this.dealRawObj(raw, model))
    }

    private async del(keyName: string, where?: string, ...params: any[]) {
        return this.db.prepare(`delete from ${keyName} ${where ? `where ${where}` : ''};`).run(...params)
    }

    private dealParamsObj(obj: any, model: StructData | RelationData) {
        const val: any = {};

        Array.from(Object.entries(obj)).forEach(([name, value]) => {
            const field = model?.fields.find(v => v.name === name)
            if (!field) return
            const typeMeta = this.typeMeta[field.type]
            const extType = { key: field.type, meta: typeMeta }
            val[name] = [isNull, notNull].includes(value as any)
                ? value
                : this.dealResVal(value, extType)
        })
        return val
    }

    private dealResObj(obj: any, model: StructData | RelationData) {
        const val: any = {};
        Array.from(Object.entries(obj)).forEach(([name, value]) => {
            const field = model?.fields.find(v => v.name === name)
            if (!field) return
            const typeMeta = this.typeMeta[field.type]
            const extType = { key: field.type, meta: typeMeta }
            if (field) val[name] = this.dealResVal(value, extType)
        })
        return val
    }

    private dealResVal(val: any, extType: ExtType) {
        const { key, meta } = extType
        const typeDeal = this.typeDeals.find(type => type.use(key, meta))
        if (!typeDeal) throw new Error()
        return typeDeal.toSave(val, {
            controller: this,
            type: extType
        })
    }

    private dealRawVal(val: any, extType: ExtType) {
        const { key, meta } = extType
        const typeDeal = this.typeDeals.find(type => type.use(key, meta))
        if (!typeDeal) throw new Error()
        return typeDeal.fromeSave(val, {
            controller: this,
            type: extType
        })
    }

    private dealRawObj(obj: any, model: StructData | RelationData) {
        const data: any = {}
        model.fields.forEach(field => {
            const typeMeta = this.typeMeta[field.type]
            const extType = { key: field.type, meta: typeMeta }
            data[field.name] = this.dealRawVal(obj[field.name], extType)
        })
        return data
    }

    private async join(
        source: [string, string, string],
        target: [string, string, string],
        where: string | null
    ) {
        const [sKey, sField, sName] = source
        const [tKey, tField, tName] = target

        const sModel = [...this.structs, ...this.relations].find(v => v.keyName === sKey)
        const tModel = [...this.structs, ...this.relations].find(v => v.keyName === tKey)
        if (!sModel || !tModel) throw new Error()
        return this.db.prepare(`
            SELECT ${sName}.*
            FROM ${sModel.keyName} ${sName}
            LEFT JOIN ${tModel.keyName} ${tName} ON ${sName}.${sField} = ${tName}.${tField}
            ${where ? `where ${where}` : ''};
        `)
    }

    typeDeals = [sqliteBaseTypeDeal, sqliteFileTypeDeal]
}


export class SqliteFileValue {

    baseUrl: string

    constructor(
        public controller: UDBSqliteController,
        public type: ExtType,
        public value: string
    ) {
        const meta = type.meta as any
        if (meta.type !== 'file_path') throw new Error()
        this.baseUrl = meta.baseUrl
    }


    get filename() {
        return (this.type.meta as any)?.encoding
            ? encodeURIComponent(this.value)
            : this.value
    }

    get filePath() {
        return this.controller.relativePath(this.baseUrl, this.filename)
    }

    isExist() {
        return accessFile(this.filePath)
    }

    readText() {
        return readFileSync(this.filePath).toString()
    }

    saveText(text: string) {
        return writeFileSync(this.filePath, text)
    }

}




