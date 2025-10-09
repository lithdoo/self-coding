import { XMLParserTask } from "./xml/xmlParser";
import xml from './struct-node.xml?raw'
import { MVRenderer } from "./render";
import { MutComputed } from "../base";

const template = new XMLParserTask(xml)

const data = {
    clientdata: ['1231312'],
    fullData: {
        'view': {
            'height': 600,
            'width': 240,
            'x': 0,
            'y': 0,
            'id': '1231312'
        },
        'data': {
            "keyName": "keyword",
            "keyField": "text",
            "fields": [
                {
                    "name": "text",
                    "type": "string",
                    "not_null": true
                },
                {
                    "name": "type",
                    "type": "string",
                    "not_null": false
                },
                {
                    "name": "idx",
                    "type": "integer",
                    "not_null": false
                },
                {
                    "name": "update_timestamp",
                    "type": "integer",
                    "not_null": true
                }
            ]
        },
    }

}

const root =  new MVRenderer(template).renderRoot(
    'render-node',
    {
        'fullData':new MutComputed(()=>data.fullData),
        'clientdata':new MutComputed(()=>data.clientdata),
    },
    ()=>{}
)


console.log(root.target.val())

setTimeout(()=>{
    root.insertTo(document.getElementById('app'))
},1000)



// const fragment = new MVRenderer(this.template)
//             .renderRoot('render-node', new MutVal({
//                 fullData: this.renderData,
//                 clientData: view.clientData
//             }), (payload, e) => {
//                 view.onNodeEvent?.(payload, e)
//             })