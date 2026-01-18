import { Notice, requestUrl } from 'obsidian';
import type { WeChatAccount } from '../settings/settings';
import * as https from 'https';

/**
 * 微信 API 响应类型
 */
interface AccessTokenResponse {
    access_token: string;
    expires_in: number;
    errcode?: number;
    errmsg?: string;
}

interface MediaUploadResponse {
    errcode: number;
    errmsg: string;
    type: string;
    media_id: string;
    url: string;
}

interface DraftCreateResponse {
    errcode: number;
    errmsg: string;
    media_id: string;
}

/**
 * 微信公众号发布器
 * 整合认证、图片上传、草稿创建的完整发布流程
 */
export class WeChatPublisher {
    private static account: WeChatAccount | null = null;
    private static accessToken: string | null = null;
    private static tokenExpireTime: number = 0;

    /**
     * 初始化发布器
     */
    static initialize(account: WeChatAccount) {
        this.account = account;
        this.accessToken = null;
        this.tokenExpireTime = 0;
    }

    /**
     * 检查是否已配置
     */
    static isConfigured(): boolean {
        return this.account !== null;
    }

    /**
     * 完整的发布流程
     */
    static async publish(previewEl: HTMLElement, title: string, app: any): Promise<void> {
        if (!this.isConfigured() || !this.account) {
            throw new Error('未配置公众号账号');
        }

        console.log('开始发布流程，账号:', this.account.name);

        try {
            // 步骤 1: 获取 access_token
            console.log('步骤 1: 获取 access_token...');
            const token = await this.getAccessToken();
            console.log('access_token 获取成功');
            new Notice('✓ 微信凭证验证成功');

            // 步骤 2: 提取内容区域
            console.log('步骤 2: 提取内容区域...');
            const contentSection = previewEl.querySelector('.mp-content-section');
            if (!contentSection) {
                console.error('找不到 .mp-content-section 元素');
                console.log('previewEl 的 HTML:', previewEl.innerHTML.substring(0, 500));
                throw new Error('找不到内容区域');
            }
            console.log('内容区域找到');

            // 步骤 3: 处理图片并上传到微信素材库
            const images = contentSection.querySelectorAll('img');
            console.log('找到图片数量:', images.length);
            let coverMediaId: string | undefined;

            if (images.length > 0) {
                new Notice(`正在上传 ${images.length} 张图片...`);

                // 第一张图片作为封面
                const firstImg = images[0];
                const firstSrc = firstImg.getAttribute('src');
                console.log('第一张图片 src:', firstSrc?.substring(0, 100));
                if (firstSrc) {
                    try {
                        const coverResult = await this.uploadImage(token, firstSrc, 'cover.png');
                        coverMediaId = coverResult.media_id;
                        firstImg.setAttribute('src', coverResult.url);
                        console.log('封面上传成功, media_id:', coverResult.media_id);
                    } catch (error) {
                        console.error('封面上传失败:', error);
                    }
                }

                // 上传其他图片
                for (let i = 1; i < images.length; i++) {
                    const img = images[i];
                    const src = img.getAttribute('src');
                    if (src) {
                        try {
                            const result = await this.uploadImage(token, src, `image-${i}.png`);
                            img.setAttribute('src', result.url);
                        } catch (error) {
                            console.error(`图片 ${i + 1} 上传失败:`, error);
                        }
                    }
                }

                new Notice('✓ 图片上传完成');
            }

            // 步骤 4: 清理并构建文章内容
            console.log('步骤 4: 清理并构建文章内容...');
            const cleanHtml = this.cleanHtml(contentSection as HTMLElement);
            const textContent = contentSection.textContent || '';
            const digest = textContent.substring(0, 100);
            console.log('文章内容长度:', cleanHtml.length);

            // 步骤 5: 创建草稿
            console.log('步骤 5: 创建草稿...');
            new Notice('正在创建草稿...');
            const article = {
                title: title,
                author: 'Obsidian',
                digest: digest,
                content: cleanHtml,
                thumb_media_id: coverMediaId || '',
                show_cover_pic: coverMediaId ? 1 : 0,
                need_open_comment: 1,
                only_fans_can_comment: 0
            };
            console.log('文章对象:', JSON.stringify(article, null, 2).substring(0, 500));

            await this.createDraft(token, article);
            console.log('发布成功！');

        } catch (error) {
            console.error('发布失败，详细错误:', error);
            const errorMsg = error instanceof Error ? error.message : '发布失败';
            throw new Error(errorMsg);
        }
    }

    /**
     * 获取 access_token
     */
    private static async getAccessToken(): Promise<string> {
        if (!this.account) {
            throw new Error('未配置公众号账号');
        }

        // 检查 token 是否有效（提前 5 分钟过期）
        if (this.accessToken && this.tokenExpireTime > Date.now() + 5 * 60 * 1000) {
            console.log('使用缓存的 access_token');
            return this.accessToken;
        }

        // 重新获取 token
        const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.account.appId}&secret=${this.account.appSecret}`;
        console.log('请求 URL:', url.replace(this.account.appSecret, '***'));

        try {
            const response = await requestUrl({
                url: url,
                method: 'GET'
            });
            const data: AccessTokenResponse = response.json;
            console.log('微信 API 响应:', JSON.stringify(data));

            if (data.errcode && data.errcode !== 0) {
                throw new Error(`获取 access_token 失败: ${data.errmsg} (errcode: ${data.errcode})`);
            }

            if (!data.access_token) {
                throw new Error('获取 access_token 失败: 响应中没有 access_token');
            }

            this.accessToken = data.access_token;
            this.tokenExpireTime = Date.now() + data.expires_in * 1000;
            console.log('access_token 获取成功，过期时间:', new Date(this.tokenExpireTime).toLocaleString());

            return this.accessToken;
        } catch (error) {
            console.error('获取 access_token 异常:', error);
            const errorMsg = error instanceof Error ? error.message : '获取 token 失败';
            throw new Error(errorMsg);
        }
    }

    /**
     * 上传图片（使用 https 模块支持 multipart/form-data）
     */
    private static async uploadImage(token: string, imageData: string, filename: string): Promise<MediaUploadResponse> {
        let buffer: Buffer;
        let mime = 'image/png';

        // 判断是 Base64 还是 URL
        if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
            // 外部 URL，需要先下载
            console.log('检测到外部图片 URL，开始下载:', imageData.substring(0, 100));
            try {
                const response = await requestUrl({
                    url: imageData,
                    method: 'GET'
                });
                // 从响应头获取 Content-Type
                const contentType = response.headers['content-type'] || 'image/png';
                mime = contentType.split(';')[0];
                // 获取图片数据（arrayBuffer）
                const arrayBuffer = response.arrayBuffer;
                buffer = Buffer.from(arrayBuffer);
                console.log('图片下载成功，大小:', buffer.length, 'MIME类型:', mime);
            } catch (error) {
                console.error('图片下载失败:', error);
                throw new Error(`图片下载失败: ${error}`);
            }
        } else if (imageData.startsWith('data:')) {
            // Base64 编码
            const arr = imageData.split(',');
            mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
            const bstr = atob(arr[1]);
            buffer = Buffer.from(bstr, 'binary');
            console.log('Base64 图片解析成功，大小:', buffer.length, 'MIME类型:', mime);
        } else {
            throw new Error('不支持的图片格式，需要 Base64 或 URL');
        }

        const urlObj = new URL(`https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${token}&type=image`);

        // 生成边界
        const boundary = '----WebKitFormBoundary' + Date.now();

        // 构建 multipart/form-data 请求体
        const crlf = '\r\n';
        let body = '';

        // 添加 media 字段
        body += '--' + boundary + crlf;
        body += 'Content-Disposition: form-data; name="media"; filename="' + filename + '"' + crlf;
        body += 'Content-Type: ' + mime + crlf;
        body += crlf;
        const bodyBuffer = Buffer.from(body, 'utf8');

        // 结束边界
        const endBoundary = crlf + '--' + boundary + '--' + crlf;
        const endBuffer = Buffer.from(endBoundary, 'utf8');

        // 组合所有部分
        const totalLength = bodyBuffer.length + buffer.length + endBuffer.length;
        const finalBuffer = Buffer.concat([bodyBuffer, buffer, endBuffer]);

        return new Promise((resolve, reject) => {
            const options = {
                hostname: urlObj.hostname,
                path: urlObj.pathname + urlObj.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'multipart/form-data; boundary=' + boundary,
                    'Content-Length': totalLength.toString()
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        const result: MediaUploadResponse = JSON.parse(data);
                        console.log('图片上传响应:', JSON.stringify(result));

                        if (result.errcode && result.errcode !== 0) {
                            reject(new Error(`图片上传失败: ${result.errmsg}`));
                        } else {
                            resolve(result);
                        }
                    } catch (error) {
                        reject(new Error('图片上传响应解析失败: ' + error));
                    }
                });
            });

            req.on('error', (error) => {
                console.error('图片上传请求错误:', error);
                reject(new Error('图片上传失败: ' + error.message));
            });

            req.write(finalBuffer);
            req.end();
        });
    }

    /**
     * 将 Base64 转换为 Blob
     */
    private static dataURLtoBlob(dataURL: string): Blob {
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    }

    /**
     * 清理 HTML，移除不必要的属性
     */
    private static cleanHtml(element: HTMLElement): string {
        const clone = element.cloneNode(true) as HTMLElement;

        // 移除 data-* 属性
        clone.querySelectorAll('*').forEach(el => {
            Array.from(el.attributes).forEach(attr => {
                if (attr.name.startsWith('data-')) {
                    el.removeAttribute(attr.name);
                }
            });
        });

        // 使用 XMLSerializer 转换为字符串
        const serializer = new XMLSerializer();
        let html = serializer.serializeToString(clone);

        // 移除外层容器的标签（如果有）
        html = html.replace(/^<[^>]+>|<\/[^>]+>$/g, '');

        return html;
    }

    /**
     * 创建草稿
     */
    private static async createDraft(token: string, article: any): Promise<string> {
        const url = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${token}`;
        const requestBody = { articles: [article] };

        console.log('创建草稿请求 URL:', url.replace(token, '***'));
        console.log('请求体长度:', JSON.stringify(requestBody).length);

        try {
            const response = await requestUrl({
                url: url,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            const data: DraftCreateResponse = response.json;
            console.log('创建草稿响应:', JSON.stringify(data));

            if (data.errcode && data.errcode !== 0) {
                throw new Error(`创建草稿失败: ${data.errmsg} (errcode: ${data.errcode})`);
            }

            if (!data.media_id) {
                throw new Error('创建草稿失败: 响应中没有 media_id');
            }

            new Notice('✓ 草稿创建成功！请到公众号后台查看');
            return data.media_id;
        } catch (error) {
            console.error('创建草稿异常:', error);
            const errorMsg = error instanceof Error ? error.message : '创建草稿失败';
            throw new Error(errorMsg);
        }
    }
}
