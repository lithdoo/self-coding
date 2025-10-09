export type ValueGeneratorRef = {
    ['_VALUE_GENERATOR_REFERENCE_']: string
}

export type ValueGenerator =
    | {
        type: 'json'
        json: string
    }
    | {
        type: 'eval:js'
        script: string
    }