import { Notice } from 'obsidian';
import { MediaUploadResponse } from './types';
import { WeChatAuthService } from './weChatAuthService';

/**
 * 微信公众号素材管理服务
 * 负责图片等素材上传到微信素材库
 */
export class WeChatMediaService {
    private authService: WeChatAuthService;

    constructor(authService: WeChatAuthService) {
        this.authService = authService;
    }

    /**
     * 将 Base64 图片转换为 Blob
     */
    private dataURLtoBlob(dataURL: string): Blob {
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
     * 上传单张图片到微信素材库
     * @param imageData Base64 格式的图片数据
     * @param filename 图片文件名
     * @returns media_id 和 url
     */
    async uploadImage(imageData: string, filename: string = 'image.png'): Promise<MediaUploadResponse> {
        const accessToken = await this.authService.getAccessToken();
        const url = `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${accessToken}&type=image`;

        try {
            // 转换 Base64 为 Blob
            const blob = this.dataURLtoBlob(imageData);

            // 创建 FormData
            const formData = new FormData();
            formData.append('media', blob, filename);
            formData.append('type', 'image');

            // 发送请求
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });

            const data: MediaUploadResponse = await response.json();

            if (data.errcode && data.errcode !== 0) {
                throw new Error(`图片上传失败: ${data.errmsg}`);
            }

            new Notice('图片上传成功');
            return data;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : '未知错误';
            new Notice(`图片上传失败: ${errorMsg}`);
            throw error;
        }
    }

    /**
     * 批量上传图片
     * @param images 图片对象数组，包含 Base64 数据和文件名
     * @returns media_id 数组
     */
    async uploadImages(images: Array<{ data: string; filename: string }>): Promise<string[]> {
        const mediaIds: string[] = [];

        for (let i = 0; i < images.length; i++) {
            try {
                const result = await this.uploadImage(images[i].data, images[i].filename);
                mediaIds.push(result.media_id);
            } catch (error) {
                new Notice(`第 ${i + 1} 张图片上传失败`);
                throw error;
            }
        }

        return mediaIds;
    }

    /**
     * 从 HTML 中提取图片并上传
     * @param htmlContent HTML 内容
     * @returns 替换后的 HTML 和 media_id 映射
     */
    async processHtmlImages(htmlContent: string): Promise<{ html: string; mediaIds: string[] }> {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const images = doc.querySelectorAll('img');

        const mediaIds: string[] = [];

        for (const img of Array.from(images)) {
            const src = img.getAttribute('src');
            if (!src) continue;

            try {
                // 上传图片
                const result = await this.uploadImage(src, `image-${Date.now()}.png`);

                // 替换图片链接为微信 CDN 链接
                img.setAttribute('src', result.url);
                mediaIds.push(result.media_id);
            } catch (error) {
                // 如果上传失败，保留原链接
                console.error('图片上传失败，保留原链接:', error);
            }
        }

        // 将处理后的 HTML 转回字符串
        const serializer = new XMLSerializer();
        const processedHtml = serializer.serializeToString(doc.body);

        return {
            html: processedHtml,
            mediaIds
        };
    }
}
