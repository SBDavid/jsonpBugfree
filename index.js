(function (factory) {

    // Establish the root object, `window` (`self`) in the browser, or `global` on the server.
    // We use `self` instead of `window` for `WebWorker` support.
    var root = (typeof self == 'object' && self.self === self && self) ||
        (typeof global == 'object' && global.global === global && global);

    if (typeof define === 'function' && define.amd) {
        // AMD
        define(['md5', 'jquery'], factory);
    } else if (typeof exports === 'object') {
        // Node, CommonJS之类的
        module.exports = factory(require('md5'), require('jquery'));
    } else {
        // 浏览器全局变量(root 即 window)
        root.jsonpBugfree = factory(root.md5, root.jQuery);
    }

})(function (md5, $) {

    var myJsonp = function () {
        var self = this;
        // 存储jsonpCallBack
        this.cbObj = {};
        // 存储阻塞的jsonp请求
        this.jsonpReqQueue = {};
        this.jsonpOptions = {
            type: 'GET',
            dataType: 'jsonp',
            cache: true,
            jsonp: 'cb',
            beforeSend: function (jqXHR, settings) {
                jqXHR.id = settings.id;
                jqXHR.jsonpkey = settings.jsonpkey;
                var previousReq = self.cbObj[settings.jsonpkey];
                previousReq.completed = false;
            },
            complete: function (jqXHR, textStatus) {
                if (self.cbObj[jqXHR.jsonpkey]) {
                    // this.cbObj标记为完成状态
                    self.cbObj[jqXHR.jsonpkey].completed = true;
                }
                // 触发dfd.then error
                var jsonpReq = self.jsonpReqQueue[jqXHR.jsonpkey].shift();
                if (jsonpReq) {
                    console.info(jqXHR, self.jsonpReqQueue)
                }
                jqXHR.then(function () {
                    jsonpReq.dfd.resolveWith(this, arguments);
                }).catch(function () {
                    jsonpReq.dfd.rejectWith(this, arguments);
                });
                // 如果队列里有排队的请求，测取出一个进行发送
                if (self.jsonpReqQueue[jqXHR.jsonpkey].length > 0) {
                    var nextReq = self.jsonpReqQueue[jqXHR.jsonpkey][0];
                    self.cleanJsonpQueue(nextReq.options);
                }
            }
        }
        this.cbCount = 0;
        this.idCount = 0;
    }

    myJsonp.prototype.cleanJsonpQueue = function (options) {
        $.ajax(options);
    }

    myJsonp.prototype.JSONP = function (options) {
        var self = this;
        var jsonpkey = md5(JSON.stringify(options));
        var dfd = $.Deferred();
        var id = this.idCount++;



        var settings = $.extend({}, this.jsonpOptions, options);

        settings.id = id;
        settings.jsonpkey = jsonpkey;

        // 如果指定了jsonpCallback
        if (settings['jsonpCallback'] != undefined && settings['url'] != undefined) {
            // 如果url从未出现过，则直接写入cbObj
            if (!self.cbObj[settings.jsonpkey]) {
                self.cbObj[settings.jsonpkey] = {
                    cb: settings['jsonpCallback'] + (++self.cbCount),
                    completed: false
                };
                settings['jsonpCallback'] = self.cbObj[settings.jsonpkey].cb;
                $.ajax(settings);
            }
            // 如果url已经出现过，则判断之前的req是否完成，
            // 如果已经完成则直接发送req,
            // 如果未完成则取消发送
            else {
                var previousReq = self.cbObj[settings.jsonpkey];
                if (previousReq.completed) {
                    settings['jsonpCallback'] = previousReq.cb;
                    $.ajax(settings)
                } else {
                    settings['jsonpCallback'] = previousReq.cb;
                    // 终止当前请求
                    console.info('发现并发性的jsonp请求', settings);
                }
            }

            var queue = this.jsonpReqQueue[jsonpkey] ? this.jsonpReqQueue[jsonpkey] : this.jsonpReqQueue[jsonpkey] = [];
            queue.push({
                dfd: dfd,
                options: settings
            });

            return dfd;
        }
        // 如果没有指定jsonpCallback，则使用随机数
        else {
            settings['jsonpCallback'] = 'callback' + Math.floor(Math.random() * 100).toString();
            delete settings.beforeSend;
            delete settings.complete;
            return $.ajax(settings);
        }
    }

    return myJsonp;
});