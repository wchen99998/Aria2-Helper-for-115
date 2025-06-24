// ==UserScript==
// @name         115 网盘 Aria2 助手
// @version      0.2.2

// @description  直接将所选 115 下载链接发送至 Aria2
// @author       tces1
// @match        *://115.com/?ct=file*
// @encoding     utf-8
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        GM_log
// @grant        GM_notification
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @license      MIT
// @connect      *

// @require      https://cdn.bootcdn.net/ajax/libs/big-integer/1.6.51/BigInteger.min.js
// @require      https://cdn.bootcdn.net/ajax/libs/blueimp-md5/2.18.0/js/md5.min.js
// @run-at       document-end
// @namespace    https://greasyfork.org/users/373796
// ==/UserScript==
// @version      0.1.6 @ 2021-04-01: This project has not been maintained for nearly three years. I fixed it by the method in the fake115 project. If it involves infringement, please notify me tg @HadsFrank.
// @version      0.1.7 @ 2021-04-19: 很多人修改不好，在tg上问我，算了直接把代码复制过来，不用修改了.
// @version      0.1.8 @ 2021-04-20: 重新引入库.
// @version      0.1.9 @ 2021-05-14: 增加通知使能选项，且通知弹出后3秒自动消失.
// @version      0.2.0 @ 2021-05-17: 更改排队模型为并发，提高发送性能，并修改aria2按钮功能，调整为点击发送至Aria2，按住Ctrl(WIN)/Command(MAC)点击直接浏览器下载，按住Alt点击仅复制下载链接，鼠标悬停按钮可见提示
// @version      0.2.1 @ 2021-05-18: 支持目录下载，发送至aira2的请求将保留目录结构，浏览器直接下载不会保留目录结构按平铺下载，近期不会再开发新功能了，仅维护现有功能
// @version      0.2.2 @ 2022-10-03: 适配115新版接口加密方案。Credit to https://gist.github.com/showmethemoney2022/430ef0e45eeb7c99fedda2d2585cfe2e
// @inspiredBy   https://greasyfork.org/en/scripts/7749-115-download-helper
// @inspiredBy   https://github.com/robbielj/chrome-aria2-integration
// @inspiredBy   https://github.com/kkHAIKE/fake115
// @inspiredBy   https://github.com/QuChao/Watsilla
// @inspiredBy   https://gist.github.com/showmethemoney2022/430ef0e45eeb7c99fedda2d2585cfe2e
/* jshint -W097 */
'use strict';

// Add CSS styles for the config modal
const modalStyles = `
.aria2-config-modal {
    display: none;
    position: fixed;
    z-index: 9999;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0,0,0,0.4);
}

.aria2-config-content {
    background-color: #fefefe;
    margin: 15% auto;
    padding: 20px;
    border: 1px solid #888;
    width: 50%;
    border-radius: 5px;
}

.aria2-config-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.aria2-config-close {
    color: #aaa;
    float: right;
    font-size: 28px;
    font-weight: bold;
    cursor: pointer;
}

.aria2-config-close:hover {
    color: black;
}

.aria2-config-form {
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.aria2-config-field {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.aria2-config-field label {
    font-weight: bold;
}

.aria2-config-field input[type="text"],
.aria2-config-field input[type="password"] {
    padding: 5px;
    border: 1px solid #ddd;
    border-radius: 3px;
}

.aria2-config-field input[type="checkbox"] {
    margin-right: 5px;
}

.aria2-config-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
}

.aria2-config-button {
    padding: 8px 16px;
    border: none;
    border-radius: 3px;
    cursor: pointer;
}

.aria2-config-save {
    background-color: #4CAF50;
    color: white;
}

.aria2-config-cancel {
    background-color: #f44336;
    color: white;
}

.aria2-wrapper {
    position: relative;
}

.aria2-subdir-panel {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 1000;
    display: none;
}

.aria2-wrapper:hover .aria2-subdir-panel {
    display: block;
}
`;

// Add the styles to the document
const styleSheet = document.createElement("style");
styleSheet.textContent = modalStyles;
document.head.appendChild(styleSheet);

// Add CSS styles for subdir dropdown
const subdirStyles = `
.aria2-wrapper {
    position: relative;
    display: inline-block;
}

.subdir-dropdown {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    background: white;
    border: 1px solid #ddd;
    z-index: 1000;
    min-width: 150px;
    max-height: 200px;
    overflow-y: auto;
}

.subdir-dropdown:hover,
.aria2-wrapper:hover .subdir-dropdown {
    display: block;
}

.subdir-item {
    padding: 5px 10px;
    cursor: pointer;
    white-space: nowrap;
}

.subdir-item:hover {
    background: #f0f0f0;
}

.subdir-input {
    padding: 5px;
    width: 200px;
    margin-top: 5px;
}
`;

// Add to existing styleSheet
styleSheet.textContent += subdirStyles;

// Config Modal HTML
const configModalHTML = `
<div id="aria2ConfigModal" class="aria2-config-modal">
    <div class="aria2-config-content">
        <div class="aria2-config-header">
            <h2>Aria2 配置</h2>
            <span class="aria2-config-close">&times;</span>
        </div>
        <form class="aria2-config-form" id="aria2ConfigForm">
            <div class="aria2-config-field">
                <label for="rpc_path">RPC 地址:</label>
                <input type="text" id="rpc_path" name="rpc_path" placeholder="http://你的域名:你的端口/jsonrpc">
            </div>
            <div class="aria2-config-field">
                <label for="rpc_token">RPC Token:</label>
                <input type="password" id="rpc_token" name="rpc_token" placeholder="你的token">
            </div>
            <div class="aria2-config-field">
                <label for="rpc_user">RPC 用户名 (可选):</label>
                <input type="text" id="rpc_user" name="rpc_user">
            </div>
            <div class="aria2-config-field">
                <label for="download_dir">下载目录:</label>
                <input type="text" id="download_dir" name="download_dir" placeholder="/root/tg-upload-py/downloads">
            </div>
            <div class="aria2-config-field">
                <label for="current_subdir">默认子目录:</label>
                <input type="text" id="current_subdir" name="current_subdir" placeholder="默认为空">
            </div>
            <div class="aria2-config-field">
                <label>
                    <input type="checkbox" id="debug_mode" name="debug_mode">
                    调试模式
                </label>
            </div>
            <div class="aria2-config-field">
                <label>
                    <input type="checkbox" id="sync_clipboard" name="sync_clipboard">
                    同步到剪贴板
                </label>
            </div>
            <div class="aria2-config-field">
                <label>
                    <input type="checkbox" id="use_http" name="use_http">
                    使用 HTTP (老版本 Aria2)
                </label>
            </div>
            <div class="aria2-config-field">
                <label>
                    <input type="checkbox" id="notification" name="notification">
                    开启通知
                </label>
            </div>
            <div class="aria2-config-buttons">
                <button type="button" class="aria2-config-button aria2-config-cancel">取消</button>
                <button type="submit" class="aria2-config-button aria2-config-save">保存</button>
            </div>
        </form>
    </div>
</div>
`;

// Add modal to document
document.body.insertAdjacentHTML('beforeend', configModalHTML);

// Config management
let Configs = {
    'debug_mode': GM_getValue('debug_mode', true),
    'sync_clipboard': GM_getValue('sync_clipboard', false),
    'use_http': GM_getValue('use_http', false),
    'rpc_path': GM_getValue('rpc_path', 'http://你的域名:你的端口/jsonrpc'),
    'rpc_user': GM_getValue('rpc_user', ''),
    'rpc_token': GM_getValue('rpc_token', '你的token'),
    'notification': GM_getValue('notification', true),
    'download_dir': GM_getValue('download_dir', '/root/tg-upload-py/downloads'),
    'current_subdir': GM_getValue('current_subdir', ''),
    'recent_subdirs': GM_getValue('recent_subdirs', []),
};

// Config modal management
function initConfigModal() {
    const modal = document.getElementById('aria2ConfigModal');
    const form = document.getElementById('aria2ConfigForm');
    const closeBtn = modal.querySelector('.aria2-config-close');
    const cancelBtn = modal.querySelector('.aria2-config-cancel');

    // Load current values
    Object.keys(Configs).forEach(key => {
        const input = document.getElementById(key);
        if (input) {
            if (input.type === 'checkbox') {
                input.checked = Configs[key];
            } else {
                input.value = Configs[key];
            }
        }
    });

    // Close modal handlers
    function closeModal() {
        modal.style.display = 'none';
    }

    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;

    window.onclick = function(event) {
        if (event.target === modal) {
            closeModal();
        }
    };

    // Save config handler
    form.onsubmit = function(e) {
        e.preventDefault();
        
        Object.keys(Configs).forEach(key => {
            const input = document.getElementById(key);
            if (input) {
                const value = input.type === 'checkbox' ? input.checked : input.value;
                Configs[key] = value;
                GM_setValue(key, value);
            }
        });

        closeModal();
        _notification('配置已保存');
    };
}

// Crypto
class MyRsa {
    constructor() {
        this.n = bigInt('8686980c0f5a24c4b9d43020cd2c22703ff3f450756529058b1cf88f09b8602136477198a6e2683149659bd122c33592fdb5ad47944ad1ea4d36c6b172aad6338c3bb6ac6227502d010993ac967d1aef00f0c8e038de2e4d3bc2ec368af2e9f10a6f1eda4f7262f136420c07c331b871bf139f74f3010e3c4fe57df3afb71683', 16)
        this.e = bigInt('10001', 16)
    };

    a2hex(byteArray) {
        var hexString = ''
        var nextHexByte
        for (var i = 0; i < byteArray.length; i++) {
            nextHexByte = byteArray[i].toString(16)
            if (nextHexByte.length < 2) {
                nextHexByte = '0' + nextHexByte
            }
            hexString += nextHexByte
        }
        return hexString
    }

    hex2a(hex) {
        var str = ''
        for (var i = 0; i < hex.length; i += 2) {
            str += String.fromCharCode(parseInt(hex.substr(i, 2), 16))
        }
        return str
    }

    pkcs1pad2(s, n) {
        if (n < s.length + 11) {
            return null
        }
        var ba = []
        var i = s.length - 1
        while (i >= 0 && n > 0) {
            ba[--n] = s.charCodeAt(i--)
        }
        ba[--n] = 0
        while (n > 2) { // random non-zero pad
            ba[--n] = 0xff
        }
        ba[--n] = 2
        ba[--n] = 0
        var c = this.a2hex(ba)
        return bigInt(c, 16)
    }

    pkcs1unpad2(a) {
        var b = a.toString(16)
        if (b.length % 2 !== 0) {
            b = '0' + b
        }
        var c = this.hex2a(b)
        var i = 1
        while (c.charCodeAt(i) !== 0) {
            i++
        }
        return c.slice(i + 1)
    }

    encrypt(text) {
        var m = this.pkcs1pad2(text, 0x80)
        var c = m.modPow(this.e, this.n)
        var h = c.toString(16)
        while (h.length < 0x80 * 2) {
            h = '0' + h
        }
        return h
    };

    decrypt(text) {
        var ba = []
        var i = 0
        while (i < text.length) {
            ba[i] = text.charCodeAt(i)
            i += 1
        }
        var a = bigInt(this.a2hex(ba), 16)
        var c = a.modPow(this.e, this.n)
        var d = this.pkcs1unpad2(c)
        return d
    };
}

class Crypto115 {
    constructor () {
      this.rsa = new MyRsa()

      this.kts = [240, 229, 105, 174, 191, 220, 191, 138, 26, 69, 232, 190, 125, 166, 115, 184, 222, 143, 231, 196, 69, 218, 134, 196, 155, 100, 139, 20, 106, 180, 241, 170, 56, 1, 53, 158, 38, 105, 44, 134, 0, 107, 79, 165, 54, 52, 98, 166, 42, 150, 104, 24, 242, 74, 253, 189, 107, 151, 143, 77, 143, 137, 19, 183, 108, 142, 147, 237, 14, 13, 72, 62, 215, 47, 136, 216, 254, 254, 126, 134, 80, 149, 79, 209, 235, 131, 38, 52, 219, 102, 123, 156, 126, 157, 122, 129, 50, 234, 182, 51, 222, 58, 169, 89, 52, 102, 59, 170, 186, 129, 96, 72, 185, 213, 129, 156, 248, 108, 132, 119, 255, 84, 120, 38, 95, 190, 232, 30, 54, 159, 52, 128, 92, 69, 44, 155, 118, 213, 27, 143, 204, 195, 184, 245]

      this.keyS = [0x29, 0x23, 0x21, 0x5E]

      this.keyL = [120, 6, 173, 76, 51, 134, 93, 24, 76, 1, 63, 70]
    }

    xor115Enc (src, srclen, key, keylen) {
      let i, j, k, mod4, ref, ref1, ref2, ret
      mod4 = srclen % 4
      ret = []
      if (mod4 !== 0) {
        for (i = j = 0, ref = mod4; (ref >= 0 ? j < ref : j > ref); i = ref >= 0 ? ++j : --j) {
          ret.push(src[i] ^ key[i % keylen])
        }
      }
      for (i = k = ref1 = mod4, ref2 = srclen; (ref1 <= ref2 ? k < ref2 : k > ref2); i = ref1 <= ref2 ? ++k : --k) {
        ret.push(src[i] ^ key[(i - mod4) % keylen])
      }
      return ret
    };

    getkey (length, key) {
      let i
      if (key != null) {
        return (() => {
          let j, ref, results
          results = []
          for (i = j = 0, ref = length; (ref >= 0 ? j < ref : j > ref); i = ref >= 0 ? ++j : --j) {
            results.push(((key[i] + this.kts[length * i]) & 0xff) ^ this.kts[length * (length - 1 - i)])
          }
          return results
        })()
      }
      if (length === 12) {
        return this.keyL.slice(0)
      }
      return this.keyS.slice(0)
    }

    asymEncode (src, srclen) {
      let i, j, m, ref, ret
      m = 128 - 11
      ret = ''
      for (i = j = 0, ref = Math.floor((srclen + m - 1) / m); (ref >= 0 ? j < ref : j > ref); i = ref >= 0 ? ++j : --j) {
        ret += this.rsa.encrypt(this.bytesToString(src.slice(i * m, Math.min((i + 1) * m, srclen))))
      }
      return window.btoa(this.rsa.hex2a(ret))
    }

    asymDecode (src, srclen) {
      let i, j, m, ref, ret
      m = 128
      ret = ''
      for (i = j = 0, ref = Math.floor((srclen + m - 1) / m); (ref >= 0 ? j < ref : j > ref); i = ref >= 0 ? ++j : --j) {
        ret += this.rsa.decrypt(this.bytesToString(src.slice(i * m, Math.min((i + 1) * m, srclen))))
      }
      return this.stringToBytes(ret)
    };

    symEncode (src, srclen, key1, key2) {
      let k1, k2, ret
      k1 = this.getkey(4, key1)
      k2 = this.getkey(12, key2)
      ret = this.xor115Enc(src, srclen, k1, 4)
      ret.reverse()
      ret = this.xor115Enc(ret, srclen, k2, 12)
      return ret
    };

    symDecode (src, srclen, key1, key2) {
      let k1, k2, ret
      k1 = this.getkey(4, key1)
      k2 = this.getkey(12, key2)
      ret = this.xor115Enc(src, srclen, k2, 12)
      ret.reverse()
      ret = this.xor115Enc(ret, srclen, k1, 4)
      return ret
    };

    bytesToString (buf) {
      let i, j, len, ret
      ret = ''
      for (j = 0, len = buf.length; j < len; j++) {
        i = buf[j]
        ret += String.fromCharCode(i)
      }
      return ret
    }

    stringToBytes (str) {
      let i, j, ref, ret
      ret = []
      for (i = j = 0, ref = str.length; (ref >= 0 ? j < ref : j > ref); i = ref >= 0 ? ++j : --j) {
        ret.push(str.charCodeAt(i))
      }
      return ret
    }

    m115_encode (str, timestamp) {
      const key = this.stringToBytes(md5(`!@###@#${timestamp}DFDR@#@#`))
      let temp = this.stringToBytes(str)
      temp = this.symEncode(temp, temp.length, key, null)
      temp = key.slice(0, 16).concat(temp)
      return {
        data: this.asymEncode(temp, temp.length),
        key
      }
    }

    m115_decode (str, key) {
      let temp = this.stringToBytes(window.atob(str))
      temp = this.asymDecode(temp, temp.length)
      return this.bytesToString(this.symDecode(temp.slice(16), temp.length - 16, key, temp.slice(0, 16)))
    }
}

//Crypto Instance
let crypto_115 = new Crypto115();

// Debug Func
let debug = Configs.debug_mode ? console.log : function () {};
let emptyFunc = function () {};

let _notification = function (msg) {
    if (Configs.notification) {
        GM_notification({
            text: msg,
            timeout: 8000
        })
    }
}

// Aria2RPC
let GLOBAL_OPTION = {}
let Aria2RPC = (function ($win, $doc) {
    // privates

    // getGlobalOption
    function _getGlobalOption() {
        let rpcHeaders = {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        };

        // auth method, pt.1
        if ('' !== Configs.rpc_user) {
            // user/password
            rpcHeaders['Authorization'] = 'Basic ' + $win.btoa(Configs.rpc_user + ':' + Configs.rpc_token);
        }

        return function (loadHandler, errorHandler) {
            // new task
            let reqParams = {
                'jsonrpc': '2.0',
                'method': 'aria2.getGlobalOption',
                'id': (+new Date()).toString(),
                'params': [],
            };

            // auth method, pt.2
            if ('' === Configs.rpc_user && '' !== Configs.rpc_token) {
                // secret, since v1.18.4
                reqParams.params.unshift('token:' + Configs.rpc_token);
            }
            debug(reqParams)

            // send to aria2, @todo: support metalink?
            GM_xmlhttpRequest({
                method: 'POST',
                url: Configs.rpc_path,
                headers: rpcHeaders,
                data: JSON.stringify(reqParams),
                onload: loadHandler || emptyFunc,
                onerror: errorHandler || emptyFunc
            });
        };
    }

    // send
    function _addTask() {
        let rpcHeaders = {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        };

        // auth method, pt.1
        if ('' !== Configs.rpc_user) {
            // user/password
            rpcHeaders['Authorization'] = 'Basic ' + $win.btoa(Configs.rpc_user + ':' + Configs.rpc_token);
        }

        return function (link, options, loadHandler, errorHandler) {
            // new task
            let reqParams = {
                'jsonrpc': '2.0',
                'method': 'aria2.addUri',
                'id': (+new Date()).toString(),
                'params': [],
            };

            // auth method, pt.2
            if ('' === Configs.rpc_user && '' !== Configs.rpc_token) {
                // secret, since v1.18.4
                reqParams.params.unshift('token:' + Configs.rpc_token);
            }

            // download link
            if ('undefined' !== typeof link) {
                // @todo: multiple sources?
                reqParams.params.push([link]);
            } else {
                // link is required
                //errorHandler({});
                return;
            }

            // options
            let finalOptions = {};
            if ('undefined' !== typeof options) {
                finalOptions = {...options};
            }

            // Handle download directory
            if (Configs.download_dir && Configs.download_dir.trim() !== '') {
                let baseDir = Configs.download_dir.replace(/\/$/, '');
                if (finalOptions.dir && finalOptions.dir.trim() !== '') {
                    // If there's a subdirectory specified, append it to the base directory
                    finalOptions.dir = baseDir + '/' + finalOptions.dir.replace(/^\//, '');
                } else {
                    // If no subdirectory, just use the base directory
                    finalOptions.dir = baseDir;
                }
            } else if (finalOptions.dir) {
                // If no base directory but has subdir, use subdir directly
                finalOptions.dir = finalOptions.dir.replace(/^\//, '');
            }

            // Add options to params if we have any
            if (Object.keys(finalOptions).length > 0) {
                reqParams.params.push(finalOptions);
            }
            
            // If in debug mode, log information instead of sending request
            if (Configs.debug_mode) {
                console.group('Aria2 Debug Information');
                console.log('Request URL:', Configs.rpc_path);
                console.log('Request Headers:', rpcHeaders);
                console.log('Request Parameters:', reqParams);
                console.log('Download Link:', link);
                console.log('Download Options:', finalOptions);
                console.log('Final Download Directory:', finalOptions.dir || 'Using Aria2 Default');
                console.groupEnd();
                
                // Simulate successful response for debug
                if (loadHandler) {
                    loadHandler({
                        status: 200,
                        responseText: JSON.stringify({
                            id: reqParams.id,
                            jsonrpc: '2.0',
                            result: 'debug-gid-' + Math.random().toString(36).substr(2, 9)
                        })
                    });
                }
            } else {
                // send to aria2
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: Configs.rpc_path,
                    headers: rpcHeaders,
                    data: JSON.stringify(reqParams),
                    onload: loadHandler || emptyFunc,
                    onerror: errorHandler || emptyFunc
                });
            }
        };
    }

    return {
        // public
        add: _addTask(),
        getGlobalOption: _getGlobalOption(),
    };
})(unsafeWindow, unsafeWindow.document);

// Direct download
let DirectDownload = (function ($win, $doc) {
    // send
    function _addTask() {
        return function (link, loadHandler, errorHandler) {
            if ('undefined' !== typeof link) {
                const iframe = document.createElement("iframe");
                iframe.style.display = "none";
                iframe.style.height = 0;
                iframe.src = link;
                document.body.appendChild(iframe);
                setTimeout(() => {
                    iframe.remove();
                }, 5 * 1000);
                loadHandler.call()
            } else {
                // link is required
                //errorHandler({});
                return;
            }
        };
    }
    return {
        add: _addTask(),
    };
})(unsafeWindow, unsafeWindow.document);

// Queue Manager
let QueueManager = (function ($win, $doc) {
    // constants
    const STATUS_SENT_TO_DIRECT_DOWNLOAD = 3;
    const STATUS_SENT_TO_ARIA2 = 2;
    const STATUS_START = 1;
    const STATUS_UNSTART = 0;
    const STATUS_DOWNLOAD_FAILURE = -1;
    const STATUS_LINK_FETCH_FAILURE = -2;
    const STATUS_GET_FILES_FAILURE = -3;

    // Pure function to fetch download link for a single file
    function fetchFileLink(pickcode) {
        return new Promise((resolve, reject) => {
            let data, key, tm, tmus;
            tmus = (new Date()).getTime();
            tm = Math.floor(tmus / 1000);
            ({data, key} = crypto_115.m115_encode(JSON.stringify({pickcode}), tm));
            
            GM_xmlhttpRequest({
                method: 'POST',
                url: `http://proapi.115.com/app/chrome/downurl?t=${tm}`,
                data: `data=${encodeURIComponent(data)}`,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                onload: (raw_resp) => {
                    let resp = JSON.parse(raw_resp.responseText);
                    if (!resp.state) {
                        reject(resp);
                    } else {
                        let resp_data = JSON.parse(crypto_115.m115_decode(resp.data, key));
                        let fileData = Object.values(resp_data)[0];
                        if ('url' in fileData && 'url' in fileData.url) {
                            resolve({
                                link: Configs.use_http ? 
                                    fileData.url.url.replace('https://', 'http://') : 
                                    fileData.url.url,
                                cookie: document.cookie
                            });
                        } else {
                            reject(fileData);
                        }
                    }
                },
                onerror: reject
            });
        });
    }

    // Pure function to fetch all direct files from a directory
    function fetchDirectoryFiles(pickcode) {
        return new Promise((resolve, reject) => {
            let tmus = (new Date()).getTime();
            let tm = Math.floor(tmus / 1000);
            
            GM_xmlhttpRequest({
                method: 'GET',
                url: `http://proapi.115.com/app/chrome/downfiles?pickcode=${pickcode}&page=1&t=${tm}`,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cookie': document.cookie,
                },
                onload: (raw_resp) => {
                    let resp = JSON.parse(raw_resp.responseText);
                    if (!resp.state) {
                        reject(resp);
                    } else {
                        // Only get direct children files (no subdirectories)
                        let files = resp.data.list
                            .filter(item => item.hasOwnProperty("pc")) // Only files, not directories
                            .map(item => ({
                                name: item.n,
                                code: item.pc
                            }));
                        resolve(files);
                    }
                },
                onerror: reject
            });
        });
    }

    // constructor
    function Mgr(options) {
        this.options = Mgr.validateOptions(options);
        this.errMsgs = [];
        this.processedCount = 0;
        this.totalCount = 0;
        this.links = [];
        this.subdir = Configs.current_subdir || '';

        // Get selected items
        let selectedNodes = $doc.getElementById('js_cantain_box').querySelectorAll('li.selected');
        
        this.selectedItems = Array.from(selectedNodes).map(node => ({
            name: node.getAttribute('title'),
            code: node.getAttribute('pick_code'),
            isDirectory: node.getAttribute('file_type') === '0'
        }));
    }

    // static
    Mgr.defaultOptions = {
        'copyOnly': false,
        'directDownload': false
    };
    
    Mgr.validateOptions = function (options) {
        for (let key in options) {
            if (!options.hasOwnProperty(key)) continue;
            if (!(key in Mgr.defaultOptions)) {
                throw Error('Invalid option: ' + key);
            } else if (typeof options[key] !== typeof Mgr.defaultOptions[key]) {
                throw Error('Invalid option type: ' + key);
            }
        }
        return Object.assign({}, Mgr.defaultOptions, options);
    };

    // Process a single file
    Mgr.prototype.processFile = async function(item) {
        try {
            const {link, cookie} = await fetchFileLink(item.code);
            this.links.push(link);
            
            if (!this.options.copyOnly) {
                if (this.options.directDownload) {
                    this.directDownload(link);
                } else {
                    this.sendToAria2(link, cookie, item.name);
                }
            }
            
            this.processedCount++;
        } catch (error) {
            this.errMsgs.push(`Failed to process file ${item.name}: ${error.msg || error.message || 'Unknown error'}`);
            this.processedCount++;
        }
    };

    // Process a directory (only direct children)
    Mgr.prototype.processDirectory = async function(item) {
        try {
            const files = await fetchDirectoryFiles(item.code);
            
            // Process each file in parallel
            const filePromises = files.map(file => this.processFile(file));
            await Promise.all(filePromises);
            
        } catch (error) {
            this.errMsgs.push(`Failed to process directory ${item.name}: ${error.msg || error.message || 'Unknown error'}`);
        }
    };

    Mgr.prototype.directDownload = function(link) {
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.style.height = 0;
        iframe.src = link;
        document.body.appendChild(iframe);
        setTimeout(() => iframe.remove(), 5000);
    };

    Mgr.prototype.sendToAria2 = function(link, cookie, filename) {
        Aria2RPC.add(link, {
            'referer': $doc.URL,
            'header': ['Cookie: ' + cookie, 'User-Agent: ' + $win.navigator.userAgent],
            'dir': this.subdir,
            'out': filename
        });
    };

    Mgr.prototype.init = async function() {
        debug("Processing selected items:", this.selectedItems);
        
        // Calculate total files to process
        for (let item of this.selectedItems) {
            if (item.isDirectory) {
                try {
                    const files = await fetchDirectoryFiles(item.code);
                    this.totalCount += files.length;
                } catch (error) {
                    this.errMsgs.push(`Failed to count files in directory ${item.name}`);
                }
            } else {
                this.totalCount++;
            }
        }

        // Process all items
        for (let item of this.selectedItems) {
            if (item.isDirectory) {
                await this.processDirectory(item);
            } else {
                await this.processFile(item);
            }
        }

        this.finish();
    };

    Mgr.prototype.finish = function() {
        let msg = [];
        msg.push(`所选 ${this.totalCount} 项已处理完毕：`);
        
        if (!this.options.copyOnly) {
            if (this.processedCount === 0) {
                msg.push('全部 发送失败');
            } else {
                msg.push((this.totalCount === this.processedCount ? '全部' : `${this.processedCount}/${this.totalCount}`) + ' 发送成功');
            }
        }
        
        _notification(msg.join("\n"));

        if (this.options.copyOnly || Configs.sync_clipboard) {
            let downloadLinks = this.links.join("\n");
            if (false === /\sSafari\/\d+\.\d+\.\d+/.test($win.navigator.userAgent)) {
                GM_setClipboard(downloadLinks, 'text');
                _notification('下载地址已同步至剪贴板');
            } else if (this.options.copyOnly) {
                prompt('本浏览器不支持访问剪贴板，请手动全选复制', downloadLinks);
            }
        }

        if (this.errMsgs.length) {
            console.error('Errors during processing:', this.errMsgs.join("\n"));
        }
    };

    return Mgr;
})(unsafeWindow, unsafeWindow.document);

// UI Helper
let UiHelper = (function ($win, $doc) {
    let _triggerId = 'aria2Trigger';
    let _configTriggerId = 'aria2ConfigTrigger';

    function _clickHandler(evt) {
        // If clicking a subdir item, handle subdir selection
        if (evt.target.classList.contains('subdir-item')) {
            evt.preventDefault();
            if (evt.target.title === "新建子目录") {
                const subdir = prompt('请输入子目录名称:', Configs.current_subdir);
                if (subdir !== null) {
                    Configs.current_subdir = subdir.trim();
                    GM_setValue('current_subdir', Configs.current_subdir);
                    updateRecentSubdirs(Configs.current_subdir);
                }
            } else {
                Configs.current_subdir = evt.target.textContent.trim();
                GM_setValue('current_subdir', Configs.current_subdir);
                updateRecentSubdirs(Configs.current_subdir);
            }
            // Update the button title
            evt.currentTarget.title = `当前子目录: ${Configs.current_subdir}\n点击发送至Aria2\n按住Alt点击仅复制链接\n按住Ctrl/Command点击直接下载`;
            return;
        }

        // Main button click - proceed without prompt
        (new QueueManager({
            'directDownload': (evt.ctrlKey || evt.metaKey) && !evt.altKey,
            'copyOnly': evt.altKey && !evt.ctrlKey && !evt.metaKey,
        })).init();
    }

    function _configClickHandler() {
        const modal = document.getElementById('aria2ConfigModal');
        modal.style.display = 'block';
    }

    function _recordHandler(record) {
        // Add Aria2 button
        let ariaTrigger = $doc.createElement('li');
        ariaTrigger.id = _triggerId;
        ariaTrigger.title = `当前子目录: ${Configs.current_subdir}\n点击发送至Aria2\n按住Alt点击仅复制链接\n按住Ctrl/Command点击直接下载`;
        ariaTrigger.innerHTML = `
            <i class="icon-operate ifo-share"></i>
            <span>Aria2</span>
        `;

        // Create popup box for subdirectory selection
        const popupBox = document.createElement('div');
        popupBox.className = 'popup-box';
        popupBox.setAttribute('data-dropdown-content', 'aria2_subdir');
        popupBox.style.cssText = 'display: none; z-index: 9999999;';
        popupBox.innerHTML = `
            <em class="arrow-position" style="left:20px; right:auto">
                <i class="arrow"></i>
                <s class="arrow"></s>
            </em>
            <div class="operation-file">
                <dl style="margin-top: 20px">
                    <dt>
                        <strong>子目录选择</strong>
                        <div class="side">
                            <div class="op-switch-wrap">
                                <span>当前目录: ${Configs.current_subdir || '默认'}</span>
                            </div>
                        </div>
                    </dt>
                    <dd>
                        <div class="list-filter" id="js_subdir_box">
                            <a href="javascript:;" class="subdir-item" title="新建子目录" style="color: #666; font-weight: bold;">
                                <i class="iofl-newfolder"></i>
                                <span>新建子目录...</span>
                            </a>
                            ${(Configs.recent_subdirs || []).map(dir => `
                                <a href="javascript:;" class="subdir-item" title="${dir}">
                                    <i class="iofl-folder"></i>
                                    <span>${dir}</span>
                                </a>
                            `).join('')}
                        </div>
                    </dd>
                </dl>
            </div>
        `;

        // Add event listeners for popup
        ariaTrigger.addEventListener('mouseenter', () => {
            const rect = ariaTrigger.getBoundingClientRect();
            popupBox.style.left = (rect.left - 30) + 'px';
            popupBox.style.top = (rect.bottom + 8) + 'px';
            popupBox.style.display = 'block';
        });

        popupBox.addEventListener('mouseleave', () => {
            popupBox.style.display = 'none';
        });

        // Handle subdirectory clicks
        popupBox.addEventListener('click', (e) => {
            e.stopPropagation();
            const subdirItem = e.target.closest('.subdir-item');
            if (!subdirItem) return;

            e.preventDefault();
            e.stopPropagation();

            const title = subdirItem.title;
            if (title === '新建子目录') {
                const subdir = prompt('请输入子目录名称:', Configs.current_subdir);
                if (subdir !== null) {
                    Configs.current_subdir = subdir.trim();
                    GM_setValue('current_subdir', Configs.current_subdir);
                    updateRecentSubdirs(Configs.current_subdir);
                    // Update current directory display
                    const currentDirSpan = popupBox.querySelector('.op-switch-wrap span');
                    currentDirSpan.textContent = `当前目录: ${Configs.current_subdir || '默认'}`;
                    // Update trigger title
                    ariaTrigger.title = `当前子目录: ${Configs.current_subdir}\n点击发送至Aria2\n按住Alt点击仅复制链接\n按住Ctrl/Command点击直接下载`;
                    // Trigger download after setting new subdir
                    (new QueueManager({
                        'directDownload': false,
                        'copyOnly': false,
                    })).init();
                }
            } else {
                Configs.current_subdir = title;
                GM_setValue('current_subdir', Configs.current_subdir);
                updateRecentSubdirs(Configs.current_subdir);
                // Update current directory display
                const currentDirSpan = popupBox.querySelector('.op-switch-wrap span');
                currentDirSpan.textContent = `当前目录: ${Configs.current_subdir || '默认'}`;
                // Update trigger title
                ariaTrigger.title = `当前子目录: ${Configs.current_subdir}\n点击发送至Aria2\n按住Alt点击仅复制链接\n按住Ctrl/Command点击直接下载`;
                // Trigger download after selecting subdir
                (new QueueManager({
                    'directDownload': false,
                    'copyOnly': false,
                })).init();
            }
            popupBox.style.display = 'none';
        });

        // Add this new event listener to prevent clicks on the dropdown from propagating
        popupBox.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });

        // Add config button to existing context menu if it doesn't exist yet
        const leftMoreMenu = $doc.querySelector('#js_context_menu_box [data-dropdown-content="left_more_menu"] .cell-icon');
        if (leftMoreMenu && !$doc.getElementById(_configTriggerId)) {
            leftMoreMenu.insertAdjacentHTML('beforeend', `
                <a href="javascript:;" id="${_configTriggerId}">
                    <i class="icon-operate ifo-settings"></i>
                    <span>Aria2配置</span>
                </a>
            `);
            // Add click event listener for config button
            $doc.getElementById(_configTriggerId).addEventListener('click', _configClickHandler);
        }

        // Insert elements
        record.target.firstChild.insertBefore(ariaTrigger, record.target.firstChild.firstChild);
        document.querySelector('.wrap-vflow').appendChild(popupBox);
        record.target.childNodes[1].setAttribute("style", "display:none;");
        
        // Add click event listener for aria trigger
        ariaTrigger.addEventListener('click', _clickHandler);

        return true;
    }

    function _init() {
        let container = $doc.getElementById('js_operate_box');
        initConfigModal();

        // Initialize recent_subdirs if it doesn't exist
        if (!Configs.recent_subdirs) {
            Configs.recent_subdirs = [];
            GM_setValue('recent_subdirs', []);
        }

        new MutationObserver(function (records) {
            records.filter(function () {
                return null === $doc.getElementById(_triggerId);
            }).some(_recordHandler);
        }).observe(container, {
            'childList': true,
        });
        
        Aria2RPC.getGlobalOption(
            function (resp) {
                if (200 === resp.status && 'responseText' in resp) {
                    GLOBAL_OPTION = JSON.parse(resp.responseText)["result"]
                    debug(GLOBAL_OPTION)
                }
            },
            undefined
        )
    }

    return {
        init: _init
    };
})(unsafeWindow, unsafeWindow.document);

// fire
UiHelper.init();

function updateRecentSubdirs(newSubdir) {
    let recent = Configs.recent_subdirs.filter(dir => dir !== newSubdir);
    recent.unshift(newSubdir);
    if (recent.length > 10) recent.pop();
    Configs.recent_subdirs = recent;
    GM_setValue('recent_subdirs', recent);
}