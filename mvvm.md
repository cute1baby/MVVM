Object.defineProperty()    给对象定义和修改属性的方法。


### 数据劫持
为什么要做数据劫持
> 观察对象和深度响应，因为给新对象定义属性或者修改属性时会给这个新对象增加defineProperty
> 使用的数据属性都需要添加get和set，

数据劫持是这里的Observe函数。

函数做了什么事情？
	把data中的属性进行循环遍历，给每一个属性都添加Object.defineProperty方法。如果属性值仍是对象，则递归，继续给子类key添加Object.defineProperty方法。

为什么一个重新编辑属性也需要给对象进行observer(newVal)?
举个例子：obj.a被监听，该对象下通过监听存在getter和setter方法，那此时将obj.a = {name:"lizhong"}之后，obj.a下的对象就不存在getter和setter了，此时需要重新给该对象监听，加上getter和setter方法。




### 数据代理
数据代理的作用是将mvvm.a代替mvvm.data.a的写法。
做法是：遍历data，给Mvvm的实例mvvm的每一个属性添加Object.defineProperty方法。并且在的getter中返回this._data[key]，在setter中this._data[key] = newVal。这样就做到了mvvm.data.a的值通过mvvm.a就能取得。





### 数据编译

数据编译是这里的Compile函数

使用createDocumentFragment创建文档碎片fragment，并且将根元素下的一级元素存储到文档碎片数组中。将fragment作为参数传入替换函数replace函数中。并且将碎片文档插入到body后面。

replace函数要做的事情就是：通过正则匹配的方式将视图模板中的文本节点和元素节点的内容，将对应key替换成data中对应的属性值。

replace函数的具体逻辑是：
找到根目录el下的所有一级元素节点，将其遍历。匹配到文本元素且有双大括号情况下，获取正则匹配的第一个分组且根据"."进行分割，获取属性数组，使用val = val[key]的方式循环取值，再将节点的内容替换成val。如视图模板中对应的是a.b.c,那么循环取值的val值就是data.a.b.c，再通过正则的replace替换。

如果一级元素节点下面还有其他节点，那么递归编译。


/**************************************总结开始******************************************/

1、上面的三个部分：数据劫持、数据代理和数据编译已经可以正常的将data中的数据对应到视图模板的显示出来了。

2、接下来的【发布订阅】和【数据更新视图】两个部分作用是：数据更新后页面重新渲染

/**************************************总结结束******************************************/


### 发布订阅
发布订阅主要靠的就是数组关系this.subs。用来装观察者Watcher的实例

订阅就是将函数放入数组，对应的是Dep实例的addSub.

发布就是让数组里的函数执行，对应的是Dep实例的notify.




### 数据更新视图
这一块做的事情比较复杂。分成下面几部分：
1、在replace中添加new Watcher(vm, RegExp.$1, newVal => {
	node.textContent = txt.replace(reg, newVal).trim();   
})
2、Watcher构造函数添加vm、exp等参数，并且将当前的实例对象赋值给Dep.target。【且获取例如this.a.b的值来触发Observer中的get方法。】获取后立即将Dep.target赋值为null.
3、在Observer函数上添加get方法，Dep.target && dep.addSub(Dep.target),目的是将watcher添加到事件订阅中;并且在setter中添加dep.notify();
4、在Watcher的原型update方法上重新获取新的val，且执行新值的回调函数。


### 双向数据绑定
1、在replace函数上添加当node.nodeType为1的情况下，即元素节点。先获取该dom上的所有属性，然后遍历到"v-"属性的时候，将新值赋值给当前节点的value。同时监听input事件的变化，并且将输入的新值赋值给data的属性。




### computed和mounted的使用
执行的时候在MVVM的回调函数设置：initComputed.call(this); 和options.mounted.call(this); 

initComputed的逻辑是：获取options.computed中的keys并且遍历，使用Object.defineProperty()来定义每一个key上的属性，添加getter方法如果属性值是函数类型，则返回computed[key],是对象则返回computed[key].get,就会触发Observer上的属性的监听相应。
