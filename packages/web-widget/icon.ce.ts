const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
document.body.appendChild(link)

class FaIconElemnt extends HTMLElement {

    private shadow: ShadowRoot

    constructor() {
        super()
        this.shadow = this.attachShadow({ mode: 'open' });
        const template = document.createElement('template');
        template.innerHTML = `
            <style>
                i{font-size:16px;display:block} 
                :host{
                    display:block;
                    width:fix-content;
                    overflow:hidden;
                }
            </style>
        `
        this.shadow.appendChild(template.content.cloneNode(true));

        // 创建 link 元素引入 Font Awesome
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';

        // 创建图标元素
        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-home';

        // 将元素添加到 shadow DOM
        this.shadow.appendChild(link);
        this.shadow.appendChild(icon);

        // 4. 克隆模板并添加到 Shadow DOM
    }


    static get observedAttributes() {
        return ['name', 'size', 'color'];
    }


    attributeChangedCallback(name: string, _oldVal: string, newVal: string) {
        if (name === 'name') {
            const iconElement = this.shadow.querySelector('i');
            // 确认元素存在后再赋值
            if (iconElement) {
                iconElement.className = `fa-solid fa-${newVal}`;
            }
        }
        if (name === 'size') {
            const iconElement = this.shadow.querySelector('i');
            // 确认元素存在后再赋值
            if (iconElement) {
                iconElement.style.fontSize = newVal;
                iconElement.style.width = newVal;
                iconElement.style.height = newVal;
            }
        }
        if (name === 'color') {
            const iconElement = this.shadow.querySelector('i');
            // 确认元素存在后再赋值
            if (iconElement) {
                iconElement.style.color = newVal;
            }
        }
    }


}


customElements.define('fa-icon', FaIconElemnt);