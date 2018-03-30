# 如何解决jquery.jsonp方法在并发情况下容易发生异常的bug

知道现在使用jsonp的公司越来越少了，似乎有比jsonp更好的跨域方案。但是我发现腾讯视屏、爱奇艺视频、优酷土豆等大型互联网公司还在使用它时，我决定写一篇文章彻底解决jsonp在并发条件下报错的问题。毕竟jsonp有最好的兼容性。

# 1. 为什么会报错
你是不是见过以下错误，通常在并发情况下容易出现这个错误，而且是否出错有随机性。
```js 
Uncaught ReferenceError: XXX is not defined
```

## 1.1 相同的jsonpCallback
造成以上错误的原因是使用了相同的jsonpCallback，由于jquery将jsonpCallback赋值到window上，并且请求完成后会删除回调方法，所以当两个jsonp请求使用相同的jsonpCallback时就会造成冲突。

## 1.2 每个请求都使用不同的jsonpCallback就没有问题吗？
如果每个请求都使用不同的jsonpCallback是可以解决以上报错问题，但是这会引发服务端性能问题。因为服务端可以通过CDN对相同的请求进行缓存，如果每次jsonpCallback都不同，服务端缓存就会失效，流向直接冲击源站。所以对用相同参数的jsonp请求jsonpCallback必须是相同的。如果不同参数或url的jsonp请求使用了相同的jsonpCallback，我们可以在jsonpCallback后面加随机数。

## 1.3 那完全相同的jsonp请求在并发时如何处理jsonpCallback冲突的BUG?
如果出现这种情况，我们在发送请求前判断当前是否有相同的jsonp请求正在发送，如果发生冲突则取消本次请求，等到上一次请求完成后再重新请求。也就是说把并发的请求转换为穿行执行。
> 有些人说可以使用async直接把并行转为穿行，不好意思这个参数在jsonp中是无效的。

## 1.4 一个隐秘的BUG
上面提到的解决方案有一个隐秘的BUG。如果不使用jsonp方法返回的延迟对象的话，以上方法没有问题。但是如果使用了延迟对象，你会发现返回的defferd对象可能永远无法触发resolve或者reject。这是应为在发现冲突后jsonp请求被取消，所以请求根本没有发出，jsonp根本不返回defferd对象。这个问题也不难解决，我们可以定义自己的defferd对象，当请求完成后手动触发resolve或者reject。这一切都已经在最终的解决方案中实现了。

# 2. 如何使用呢？

## 2.1 依赖
- jquery 这个不用说，依赖$.ajax()方法
- md5 其实这个不是必须的，使用它的目的是为了判断请求的url和参数是否和其他请求相同。因为url+参数可能是一个非常长的字符串，使用md5可以控制字符长度。如果你不想使用md5也可以使用其他方法代替。

## 2.2 引入模块
支持amd、commonjs、script标签直接引用。

## 2.3 demo
```js
var myjsonp = new jsonpBugfree();

myjsonp.JSONP({
                url: 'http://url',
                data: {
                    test: 1
                },
                cache: true,
                dataType: 'jsonp',
                jsonp: 'cb',
                jsonpCallback: 'jsonpCallback',
                success: function () {

                }
            })
            .then(function () {
                // todo
            })
            .catch(function () {
                // todo
            })

```