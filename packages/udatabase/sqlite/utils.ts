import { accessSync, existsSync, unlinkSync, writeFileSync } from "fs";
import type { RelationData, StructData, UDBMetaData } from "../base";
import Database from 'better-sqlite3';
import path from "path";

export const createDBFile = (dirPath: string, metadata: UDBMetaData) => {

    const tables = [...metadata.relations, ...metadata.structs]

    const filePath = path.resolve(dirPath, './index.new.db')

    console.log(filePath)

    writeFileSync(filePath, '')

    const db = new Database(filePath)

    tables.forEach(table => {
        createTableFromDefinition(db, table)
    })

}

export const createTsFile = (dirPath: string, metadata: UDBMetaData) => {
    const tables = [...metadata.relations, ...metadata.structs]

    const filePath = path.resolve(dirPath, './interface.ts')

    console.log(filePath)


    const content = tables.map(table => {
        return generateInterfaceFile(table)
    }).join('')
    
    const structsDef = `export type StructDef = {
${tables.map(v=>`   ${v.keyName}:${v.keyName.toLocaleUpperCase()};`).join(`\n`)}
}`


    writeFileSync(filePath, content + structsDef)

}


/**
 * 根据表结构生成TypeScript接口，直接使用keyName作为接口名
 * @param schema 表结构的JSON数据
 * @param outputPath 输出文件路径
 */
function generateInterfaceFile(schema: RelationData | StructData): string {
    // 直接使用keyName作为接口名称
    const interfaceName = schema.keyName.toLocaleUpperCase();

    // 生成接口字段定义
    const fieldsDefinition = schema.fields.map(field => {
        const tsType = convertToTsType(field.type);
        // 根据not_null决定是否为可选字段
        const optionalMarker = field.not_null ? '' : '?';
        return `  ${field.name}${optionalMarker}: ${tsType};`;
    }).join('\n');
    const interfaceContent = `/**
 * 对应表结构: ${schema.keyName}
 */
export interface ${interfaceName} {
${fieldsDefinition}
}
`;

    return interfaceContent
}

// 转换TypeScript类型到SQLite类型
function convertType(tsType: string): string {
    switch (tsType.toLowerCase()) {
        case 'string':
            return 'TEXT';
        case 'integer':
            return 'INTEGER';
        case 'number':
            return 'REAL';
        case 'boolean':
            return 'INTEGER'; // SQLite用1和0表示布尔值
        default:
            return 'TEXT';
    }
}

/**
 * 将JSON schema类型转换为TypeScript类型
 * @param jsonType JSON中定义的类型
 * @returns 对应的TypeScript类型
 */
function convertToTsType(jsonType: string): string {
    switch (jsonType.toLowerCase()) {
        case 'string':
            return 'string';
        case 'integer':
        case 'number':
            return 'number';
        case 'boolean':
            return 'boolean';
        default:
            return 'any';
    }
}




// 创建表的函数
function createTableFromDefinition(db: Database.Database, tableDef: RelationData | StructData): void {
    // 构建字段定义部分
    const fieldDefinitions = tableDef.fields.map(field => {
        const target = ((tableDef as RelationData).relations ?? [])
            .find(v => v.field === field.name)
        const UNIQUE = target?.only
        const parts = [
            `"${field.name}" ${convertType(field.type)}`,
            field.not_null ? 'NOT NULL' : '',
            UNIQUE ? 'UNIQUE' : ''
        ].filter(Boolean); // 过滤空字符串

        return parts.join(' ');
    });

    // 构建完整的CREATE TABLE语句
    const createTableSql = `
    CREATE TABLE IF NOT EXISTS "${tableDef.keyName}" (
      ${fieldDefinitions.join(',\n      ')}
    )
  `;

    console.log('执行的SQL语句:', createTableSql);

    // 执行SQL语句
    db.prepare(createTableSql).run();
    console.log(`表 "${tableDef.keyName}" 创建成功`);
}
