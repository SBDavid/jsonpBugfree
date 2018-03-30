(function (factory) {

    // Establish the root object, `window` (`self`) in the browser, or `global` on the server.
    // We use `self` instead of `window` for `WebWorker` support.
    var root = (typeof self == 'object' && self.self === self && self) ||
        (typeof global == 'object' && global.global === global && global);

    // Set up jsonpBugfree appropriately for the environment. Start with AMD.
    if (typeof define === 'function' /* && define.amd */) {
        define(['md5', 'jquery', 'exports'], function (md5, $, exports) {
            // Export global even in AMD case in case this script is loaded with
            // others that may still expect a global jsonpBugfree.
            root.jsonpBugfree = factory(root, exports, md5, $);
        });

        // Next for Node.js or CommonJS. jQuery may not be needed as a module.
    } else if (typeof exports !== 'undefined') {
        var md5 = require('md5'), $;
        try { $ = require('jquery'); } catch (e) { }
        factory(root, exports, md5, $);

        // Finally, as a browser global.
    } else {
        root.jsonpBugfree = factory(root, {}, root.md5, (root.jQuery || root.$));
    }

})(function (root, jsonpBugfree, md5, $) {

    jsonpBugfree = function() {
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
            beforeSend: function(jqXHR, settings ) {
                console.info('beforeSend', settings);
                jqXHR.id = settings.id;
                jqXHR.jsonpkey = settings.jsonpkey;
                // 如果指定了jsonpCallback
                if (settings['jsonpCallback'] != undefined && settings['url'] != undefined) {
                    // 如果url从未出现过，则直接写入cbObj
                    if (!self.cbObj[settings.jsonpkey]) {
                        self.cbObj[settings.jsonpkey] = {
                            cb: settings['jsonpCallback'] + (++self.cbCount),
                            completed: false
                        };
                        settings['jsonpCallback'] = self.cbObj[settings.jsonpkey].cb;
                    }
                    // 如果url已经出现过，则判断之前的req是否完成，
                    // 如果已经完成则直接发送req,
                    // 如果未完成则取消发送
                    else {
                        var previousReq = self.cbObj[settings.jsonpkey];
                        if (previousReq.completed) {
                            settings['jsonpCallback'] = previousReq.cb;
                            previousReq.completed = false;
                        } else {
                            // 终止当前请求
                            console.info('发现并发性的jsonp请求', settings);
                            return false;
                        }
                    }
                }
                // 如果没有指定jsonpCallback，则使用随机数
                else {
                    settings['jsonpCallback'] = 'callback' + Math.floor(Math.random() * 100).toString();
                }
            },
            complete: function(jqXHR, textStatus) {
                console.info('complete', textStatus, jqXHR);
                // this.cbObj标记为完成状态
                self.cbObj[jqXHR.jsonpkey].completed = true;
                // 触发dfd.then error
                var jsonpReq = self.jsonpReqQueue[jqXHR.jsonpkey].shift();
                jqXHR.then(function(){
                    jsonpReq.dfd.resolveWith(this, arguments);
                }).catch(function() {
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
    
    jsonpBugfree.prototype.cleanJsonpQueue = function(options) {
        var settings = $.extend({}, this.jsonpOptions, options);
        $.ajax(settings);
    }
    
    jsonpBugfree.prototype.JSONP = function(options) {
        var jsonpkey = md5(JSON.stringify(options));
        var dfd = $.Deferred();
        var id = this.idCount++;
        var completed = false;
    
        options.id = id;
        options.jsonpkey = jsonpkey;
    
        var queue = this.jsonpReqQueue[jsonpkey] ? this.jsonpReqQueue[jsonpkey] : this.jsonpReqQueue[jsonpkey] = [];
        queue.push({
            dfd: dfd,
            options: options
        });
    
        var settings = $.extend({}, this.jsonpOptions, options);
        $.ajax(settings);
    
        return dfd;
    }

    return jsonpBugfree;
});