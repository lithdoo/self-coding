import { BaseType, type ExtType, type RelationData, type StructData, type UDBController, type UDBMetaData } from "../base"
import Database from "better-sqlite3"
import { createDBFile, createTsFile } from "./utils"
import path from "path"
import { accessFile } from "../utils"
import { accessSync, copyFileSync, cpSync, existsSync, readFileSync, unlinkSync, writeFileSync } from "fs"

export interface UDBMetaDataWithDir extends UDBMetaData {
    dirPath: string
}


export interface TypeHandler {
    use(keyName: string, meta: unknown): boolean

    toSave(source: unknown, option: {
        dirPath: string,
        type: ExtType
    }): any

    fromeSave(source: unknown, option: {
        dirPath: string,
        type: ExtType
    }): any

}


export type UDBRecordModel = StructData | RelationData

export interface UDBRecord<S, T> {
    keyName: S
    model: UDBRecordModel,
    data: T
    get<S extends keyof T>(name: S): T
}


export interface UDBRecordList<S, T> {
    keyName: S
    model: UDBRecordModel,
    list: T[]
    first(): UDBRecord<S, T> | null
}


export const isNull = Symbol()
export const notNull = Symbol()

export abstract class UDBSqlTask {


    abstract readonly db: Database.Database
    abstract readonly metadata: UDBMetaDataWithDir
    abstract readonly model: UDBRecordModel
    abstract readonly typeDeals: TypeHandler[]

    protected dealParamsObj(obj: any) {
        const val: any = {};
        const model = this.model

        Array.from(Object.entries(obj)).forEach(([name, value]) => {
            const field = model?.fields.find(v => v.name === name)
            if (!field) return
            const typeMeta = this.metadata.typeMeta[field.type]
            const extType = { key: field.type, meta: typeMeta }
            val[name] = [isNull, notNull].includes(value as any)
                ? value
                : this.toSaveVal(value, extType)
        })
        return val
    }


    protected dealResObj(obj: any, model: StructData | RelationData) {
        const val: any = {};
        Array.from(Object.entries(obj)).forEach(([name, value]) => {
            const field = model?.fields.find(v => v.name === name)
            if (!field) return
            const typeMeta = this.metadata.typeMeta[field.type]
            const extType = { key: field.type, meta: typeMeta }
            if (field) val[name] = this.toSaveVal(value, extType)
        })
        return val
    }

    protected toSaveVal(val: any, extType: ExtType) {
        const { key, meta } = extType
        const typeDeal = this.typeDeals.find(type => type.use(key, meta))
        if (!typeDeal) throw new Error()
        return typeDeal.toSave(val, { type: extType, dirPath: this.metadata.dirPath })
    }


    protected dealRawObj(obj: any) {
        const data: any = {}
        this.model.fields.forEach(field => {
            const typeMeta = this.metadata.typeMeta[field.type]
            const extType = { key: field.type, meta: typeMeta }
            data[field.name] = this.dealRawVal(obj[field.name], extType)
        })
        return data
    }

    protected dealRawVal(val: any, extType: ExtType) {
        const { key, meta } = extType
        const typeDeal = this.typeDeals.find(type => type.use(key, meta))
        if (!typeDeal) throw new Error()
        return typeDeal.fromeSave(val, {
            type: extType, dirPath: this.metadata.dirPath
        })
    }


}

export abstract class UDBWhereTask<T> extends UDBSqlTask {
    whereSql: string | null = ''
    whereSqlWithoutColumRemane: string | null = ''
    whereParams: { [key: string]: any } = {}

    constructor(
        public readonly rename?: string
    ) {
        super()
    }
    get renameDot() {
        if (!this.rename) return ''
        else return `${this.rename}.`
    }

    get renameUnderline() {
        if (!this.rename) return ''
        else return `____${this.rename}____`
    }

    where(part: { [Key in keyof T]?: T[Key] | symbol }) {
        const val = this.dealParamsObj(part)
        this.whereParams = {}
        this.whereSql = Array.from(Object.entries(val)).map(([name, value]) => {
            if (value === isNull)
                return ` ${this.renameDot}${name} is null `
            else if (value === notNull)
                return ` ${this.renameDot}${name} not null `
            else {
                this.whereParams[`${this.renameUnderline}${name}`] = value
                return ` ${this.renameDot}${name} = @${this.renameUnderline}${name} `
            }
        }).join(' and ')


        this.whereSqlWithoutColumRemane = Array.from(Object.entries(val)).map(([name, value]) => {
            if (value === isNull)
                return ` ${name} is null `
            else if (value === notNull)
                return ` ${name} not null `
            else {
                this.whereParams[`${this.renameUnderline}${name}`] = value
                return ` ${name} = @${name} `
            }
        }).join(' and ')

        return this
    }

}

export abstract class UDBSelectTask<S, T> extends UDBWhereTask<T> {

    private toRecord(val: any): UDBRecord<S, T> | null {
        if (!val) return null
        return {
            model: this.model,
            keyName: this.model.keyName as S,
            data: val,
            get() { return this.data }
        }
    }

    private toRecordList(list: any[]): UDBRecordList<S, T> {
        return {
            model: this.model,
            keyName: this.model.keyName as S,
            list: list.map(v => this.dealRawObj(v)),
            first() {
                if (this.list[0]) {
                    return {
                        model: this.model,
                        keyName: this.model.keyName as S,
                        data: this.list[0],
                        get() { return this.data }
                    }
                } else {
                    return null
                }
            }
        }
    }


    rawToRecord(raw: any) {
        return this.toRecord(raw && this.dealRawObj(raw))
    }

    rawToRecordList(rawList: any[]) {
        return this.toRecordList(rawList)
    }

    find() {
        console.log(`select ${this.renameDot}* from ${this.model.keyName} ${this.rename ?? ''} ${this.whereSql ? `where ${this.whereSql}` : ''};`)
        const raw = this.db
            .prepare(`select ${this.renameDot}* from ${this.model.keyName} ${this.rename ?? ''} ${this.whereSql ? `where ${this.whereSql}` : ''};`)
            .get(this.whereParams)
        return this.rawToRecord(raw)
    }

    query() {
        const rawList = this.db
            .prepare(`select ${this.renameDot}* from ${this.model.keyName} ${this.rename ?? ''} ${this.whereSql ? `where ${this.whereSql}` : ''};`)
            .all(this.whereParams)

        return this.rawToRecordList(rawList)
    }

    remove() {
        this.db
            .prepare(`delete from ${this.model.keyName}  ${this.rename ?? ''}   ${this.whereSql ? `where ${this.whereSql}` : ''};`)
            .run(this.whereParams)
        return
    }
}

export abstract class UDBInsertTask<S, T> extends UDBSelectTask<S, T> {
    insert<T = any>(data: T) {
        const model = this.model
        const val = this.dealResObj(data, model)
        const keys = [...Object.keys(val)]
        const state = this.db.prepare(`
            INSERT INTO ${model.keyName} (${keys.join(', ')})
            VALUES (${keys.map(v => `@${v}`).join(', ')})
            RETURNING *
        `)

        state.run(val)
    }
}

export abstract class UDBUpdateTask<S, T> extends UDBInsertTask<S, T> {
    updateByKey(data: Partial<T>, autoInsert: boolean = true) {
        const model = this.model
        if (!model) throw new Error()
        const val = this.dealResObj(data, model)
        const keyFields = (model as StructData).keyField
            ? [(model as StructData).keyField]
            : (model as RelationData).relations.map(v => v.field)

        const keyPart: Partial<T> = keyFields
            .map(name => ({ name, value: (data as any)[name] }))
            .reduce((res, current) => ({ ...res, [current.name]: current.value }), {})

        const exist = this.where(keyPart)
            .find()

        if (exist) {
            console.log('updateByKey')
            const dataKeys = [...Object.keys(val)].filter(v => !keyFields.includes(v))
            if (!dataKeys.length) throw new Error()
            this.where(keyPart)
            console.log(`
                    update ${this.model.keyName} ${this.rename}
                    set ${dataKeys.map(n => `${n} = @${n}`).join(', ')}
                    where ${this.whereSql}
               ` , val)
            const state = this.db.prepare(`
                    update ${this.model.keyName} 
                    set ${dataKeys.map(n => `${n} = @${n}`).join(', ')}
                    where ${this.whereSqlWithoutColumRemane}
                `)
            state.run(val)
        } else if (autoInsert) {
            return this.insert(data)
        } else {
            throw new Error('target value not exist')
        }
    }
}

export abstract class UDBSelectWithTask<SourceName, SourceType, TargetName, TargetType> {
    protected abstract source: UDBSelectTask<SourceName, SourceType>
    protected abstract target: UDBWhereTask<TargetType>


    protected onField?: [keyof SourceType, keyof TargetType]

    on(sourceField: keyof SourceType, targetField: keyof TargetType) {
        this.onField = [sourceField, targetField]
        return
    }

    whereSource(part: { [Key in keyof SourceType]?: SourceType[Key] | symbol }) {
        this.source.where(part)
        return this
    }

    whereTarget(part: { [Key in keyof TargetType]?: TargetType[Key] | symbol }) {
        this.target.where(part)
        return this
    }

    private sql() {
        if (!this.onField) throw new Error('onField is not defined')
        return `select ${this.source.renameDot}* 
    from ${this.source.model.keyName} ${this.source.rename ?? ''} 
    LEFT JOIN ${this.target.model.keyName} ${this.target.rename ?? ''} 
    ON ${this.source.renameDot}${String(this.onField[0])} = ${this.target.renameDot}${String(this.onField[1])}
    ${(this.source.whereSql || this.target.whereSql) ? `where` : ''}
            ${this.target.whereSql}
    ${(this.source.whereSql && this.target.whereSql) ? `and` : ''}
            ${this.source.whereSql}
;`
    }

    find() {
        if (!this.onField) throw new Error('lack onField!!!')
        const sql = this.sql()
        console.log(sql)
        const whereParams = {
            ...this.source.whereParams,
            ...this.target.whereParams
        }

        const raw = this.source.db
            .prepare(sql)
            .get(whereParams)


        return this.source.rawToRecord(raw)
    }

    query() {
        if (!this.onField) throw new Error('lack onField!!!')
        const sql = this.sql()
        console.log(sql)
        const whereParams = {
            ...this.source.whereParams,
            ...this.target.whereParams
        }

        const rawList = this.source.db
            .prepare(sql)
            .all(whereParams)


        return this.source.rawToRecordList(rawList)
    }

}


export class SqliteFileValue {

    static create(meta: UDBMetaDataWithDir, typeKeyName: string, value: string) {
        const type = {
            key: typeKeyName,
            meta: meta.typeMeta[typeKeyName]
        }
        const dirPath = meta.dirPath
        return new SqliteFileValue(type, value, dirPath)
    }


    baseUrl: string

    constructor(
        public type: ExtType,
        public value: string,
        public dirPath: string
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
        return path.resolve(this.dirPath, this.baseUrl, this.filename)
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
    copyFile(source: string) {
        accessSync(source)
        if (existsSync(this.filePath)) {
            unlinkSync(this.filePath)
        }
        return copyFileSync(source, this.filePath)
    }

}



export const sqliteBaseTypeDeal: TypeHandler = {
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

export const sqliteFileTypeDeal: TypeHandler = {
    use: (_: string, meta: any) => {
        return meta?.type === 'file_path'
    },

    toSave(source: SqliteFileValue | null) {
        return source?.value ?? null
    },

    fromeSave(source: any, option) {
        if (source) {
            return new SqliteFileValue(
                option.type,
                source as string,
                option.dirPath
            )
        } else {
            return null
        }

    }
}

export abstract class UDBConnection<T> {

    readonly db: Database.Database
    readonly metadata: UDBMetaDataWithDir

    constructor(
        public dbPath: string,
        public readonly typeDeals: TypeHandler[] = [sqliteBaseTypeDeal, sqliteFileTypeDeal]
    ) {
        this.metadata = this.loadMetadata()
        this.db = new Database(this.dbPath)
    }

    get dirPath(): string {
        return path.dirname(this.dbPath)
    }

    createNewDBFile() {
        createDBFile(this.dirPath, this.metadata)
    }

    createTsFile(dir: string) {
        createTsFile(dir, this.metadata)
    }


    relativePath(...to: string[]) {
        return path.resolve(this.dirPath, ...to)
    }

    private loadMetadata() {
        const metadata: UDBMetaDataWithDir = {
            structs: [],
            relations: [],
            typeMeta: {},
            dirPath: this.dirPath
        }

        if (accessFile(this.relativePath('./ext_type.json'))) {
            const list = JSON.parse(readFileSync(this.relativePath('./ext_type.json')).toString())
            metadata.typeMeta = list
        }


        if (accessFile(this.relativePath('./struct.json'))) {
            const list = JSON.parse(readFileSync(this.relativePath('./struct.json')).toString())
            metadata.structs = list
        }


        if (accessFile(this.relativePath('./relation.json'))) {
            const list = JSON.parse(readFileSync(this.relativePath('./relation.json')).toString())
            metadata.relations = list
        }
        return metadata
    }

    getModel<S extends keyof T>(keyName: S) {
        const model = [...this.metadata.structs, ...this.metadata.relations].find(v => v.keyName === keyName)
        if (!model) {
            throw new Error(`unknown keyname: ${String(keyName)}`)
        } else {
            return model
        }
    }

    select<S extends keyof T>(keyName: S) {
        const model = this.getModel(keyName)
        const { db, typeDeals, metadata } = this
        return new class extends UDBUpdateTask<S, T[S]> {
            db = db
            model = model
            typeDeals = typeDeals
            metadata = metadata
        }('source')
    }


    selectWith<SourceName extends keyof T, TargetName extends keyof T,>(
        sourceName: SourceName, targetName: TargetName
    ) {
        const sourceModel = this.getModel(sourceName)
        const targetModel = this.getModel(targetName)

        const { db, typeDeals, metadata } = this
        const source = new class extends UDBSelectTask<SourceName, T[SourceName]> {
            db = db
            model = sourceModel
            typeDeals = typeDeals
            metadata = metadata
        }('source')

        const target = new class extends UDBWhereTask<T[TargetName]> {
            db = db
            model = targetModel
            typeDeals = typeDeals
            metadata = metadata
        }('target')

        let onField: [any, any] | undefined
        if (
            (targetModel as RelationData).relations &&
            (sourceModel as StructData).keyField
        ) {
            const relaField = (targetModel as RelationData).relations.find(v => v.struct === sourceModel.keyName)
            if (relaField) {
                onField = [(sourceModel as StructData).keyField, relaField.field]
            }
        }


        if (
            (sourceModel as RelationData).relations &&
            (targetModel as StructData).keyField
        ) {
            const relaField = (sourceModel as RelationData).relations.find(v => v.struct === targetModel.keyName)
            if (relaField) {
                onField = [relaField.field, (targetModel as StructData).keyField]
            }
        }


        const task = new class extends UDBSelectWithTask<
            SourceName, T[SourceName],
            TargetName, T[TargetName]> {
            source = source
            target = target
        }

        if (onField) {
            task.on(...onField)
        }
        return task
    }

}




