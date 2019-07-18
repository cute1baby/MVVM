/*构造一个Mvvm函数*/
function Mvvm(options = {}) {
    // 将所有属性挂载到了$options
    this.$options = options;
    // this._data 这里也和Vue一样
    let data = this._data = this.$options.data;

    // 数据劫持
    observe(data);

    /**
     * *数据代理
     */
    for (let key in data) {
        Object.defineProperty(this, key, {  //给实例vm添加上data的key属性。
            configurable: true,
            get() {
                return this._data[key];     // 如this.a = {b: 1}
            },
            set(newVal) {
                this._data[key] = newVal;
            }
        });
    }
    
    // 所有事情处理好后执行mounted钩子函数。这就实现了mounted钩子函数 ？？？
    options.mounted && options.mounted.call(this); 

    /** 初始化computed,将this指向实例**/
    initComputed.call(this);     

    /*数据编译*/
    new Compile(options.el, this);
}


/************************************数据劫持开始******************************************/

/*
 * Observe：数据劫持的主要逻辑
 * observe：创建一个函数，无需重复实例化Observe
 */
function Observe(data) {
    // 数据劫持就是通过递归和循环给对象所有属性增加get,set
    for (let key in data) {     // 把data属性通过defineProperty的方式定义属性
        let dep = new Dep(); // 一个data内n个属性就有n个dep.
        let val = data[key];
        observe(val);   // 递归继续向下找，实现深度的数据劫持
        Object.defineProperty(data, key, {
            configurable: true, //该属性是否可删除可配置
            get() {
                Dep.target && dep.addSub(Dep.target);   // 将watcher添加到订阅事件中 [watcher]
                return val;
            },
            set(newVal) {   // 更改值的时候
                if (val === newVal) {   // 设置的值和以前值一样就不理它
                    return;
                }
                val = newVal;   // 如果以后再获取值(get)的时候，将刚才设置的值再返回去
                observe(newVal);    //当设置为新值后，需要把新值也增加Object.defineProperty
                dep.notify();   // 让所有watcher的update方法执行即可
            }
        });
    }
}

// 不用每次调用都写个new，方便递归调用
function observe(data) {
    // 如果不是对象的话就直接return掉
    // 防止递归溢出
    if (!data || typeof data !== 'object') return;
    return new Observe(data);
}

/************************************数据劫持结束******************************************/




/************************************数据编译开始******************************************/
// 创建Compile构造函数
function Compile(el, vm) {
    // 将el挂载到实例上方便调用
    vm.$el = document.querySelector(el);
    // 将所有的一级节点添加到文档碎片中。   使用文档碎片中，节省开销
    let fragment = document.createDocumentFragment();
    while (child = vm.$el.firstChild) {
        fragment.appendChild(child);    // 此时将el内的一级标签放入内存中
    }

    // 对el里面的内容进行替换
    function replace(frag) {
        Array.from(frag.childNodes).forEach(node => {
            let txt = node.textContent;
            let reg = /\{\{(.*?)\}\}/g;   // 正则匹配{{}}

            if (node.nodeType === 3 && reg.test(txt)) { // 即是文本节点又有大括号的情况{{}}
                // console.log(RegExp.$1); // 匹配到的第一个分组 如： a.b, c
                let arr = RegExp.$1.split('.');  // 匹配{{}}（正则匹配）内的文本
                let val = vm;
                arr.forEach(key => {
                    val = val[key];     // 如this.a.b
                });
                // 赋值给txt去除一下首尾空格
                node.textContent = txt.replace(reg, val).trim();

                // 【新增】实例化监视者，并设定回调函数为DOM节点替换成新值。
                new Watcher(vm, RegExp.$1, newVal => {
                    node.textContent = txt.replace(reg, newVal).trim();
                });
            }



            /****************双向数据绑定开始******************/
            if (node.nodeType === 1) {  // 元素节点
                let nodeAttr = node.attributes; // 获取元素节点上的所有属性,是个类数组
                Array.from(nodeAttr).forEach(attr => {
                    let name = attr.name;   // v-model  type
                    let exp = attr.value;   // c        text
                    if (name.includes('v-')){
                        node.value = vm[exp];   // this.c 为 2
                    }
                    // 监听变化【为啥要写，没明白】
                    new Watcher(vm, exp, function(newVal) {
                        node.value = newVal;   // 当watcher触发时会自动将内容放进输入框中
                    });

                    node.addEventListener('input', e => {
                        let newVal = e.target.value;
                        // 相当于给this.c赋了一个新值
                        // 而值的改变会调用set，set中又会调用notify，notify中调用watcher的update方法实现了更新
                        vm[exp] = newVal;
                    });
                });
            }
            /****************双向数据绑定结束******************/


            // 如果还有子节点，继续递归replace
            if (node.childNodes && node.childNodes.length) {
                replace(node);
            }
        });
    }

    replace(fragment);  // 替换内容

    vm.$el.appendChild(fragment);   // 再将文档碎片放入el中
}

/************************************数据编译结束******************************************/




/************************************发布订阅开始******************************************/
// 发布订阅模式  订阅和发布 如[fn1, fn2, fn3]
function Dep() {
    // 一个数组(存放函数的事件池)
    this.subs = [];
}
Dep.prototype = {
    /*addSub是属于订阅*/
    addSub(sub) {
        this.subs.push(sub);
    },
    notify() {
        // 绑定的方法，每个sub（其实是Watch的实例）都执行update方法
        this.subs.forEach(sub => sub.update());
    }
};



// 通过Watcher这个类创建的实例，都拥有update方法，用来更新视图层下的节点
function Watcher(vm, exp, fn) {
    this.fn = fn;   // 将fn放到实例上

    // 【新增】这一块的Dep.target个人认为是难点
    this.vm = vm;
    this.exp = exp;

    Dep.target = this;
    let arr = exp.split('.');
    let val = vm;
    arr.forEach(key => {    // 取值
       val = val[key];     // 获取到this.a.b，默认就会调用get方法
    });
    Dep.target = null;
}
/*update是属于发布*/
Watcher.prototype.update = function() {
    let arr = this.exp.split('.');
    let val = this.vm;
    arr.forEach(key => {
        val = val[key];   // 通过get获取到新的值
    });
    this.fn(val);   // 将每次拿到的新值去替换{{}}的内容即可
};


/************************************发布订阅结束******************************************/



/*******************************computed(计算属性)开始*************************************/

function initComputed() {
    let vm = this;
    let computed = this.$options.computed;  // 从options上拿到computed属性   {sum: ƒ, noop: ƒ}
    // 得到的都是对象的key可以通过Object.keys转化为数组
    Object.keys(computed).forEach(key => {  // key就是sum,noop
        Object.defineProperty(vm, key, {
            // 这里判断是computed里的key是对象还是函数
            // 如果是函数直接就会调get方法
            // 如果是对象的话，手动调一下get方法即可
            // 如： sum() {return this.a + this.b;},他们获取a和b的值就会调用get方法
            // 所以不需要new Watcher去监听变化了
            get: typeof computed[key] === 'function' ? 
                 computed[key] : computed[key].get,
            set() {}
        });
    });
}

/*******************************computed(计算属性)结束*************************************/
