import { Notice } from 'obsidian';
import { DraftArticle, DraftCreateResponse } from './types';
import { WeChatAuthService } from './weChatAuthService';

/**
 * 微信公众号草稿箱服务
 * 负责创建和管理草稿
 */
export class WeChatDraftService {
    private authService: WeChatAuthService;

    constructor(authService: WeChatAuthService) {
        this.authService = authService;
    }

    /**
     * 创建草稿
     * @param article 草稿文章数据
     * @returns media_id
     */
    async createDraft(article: DraftArticle): Promise<string> {
        const accessToken = await this.authService.getAccessToken();
        const url = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${accessToken}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    articles: [article]
                })
            });

            const data: DraftCreateResponse = await response.json();

            if (data.errcode && data.errcode !== 0) {
                throw new Error(`创建草稿失败: ${data.errmsg}`);
            }

            if (!data.media_id) {
                throw new Error('创建草稿失败: 响应中没有 media_id');
            }

            new Notice('草稿创建成功，请到微信公众号后台查看');
            return data.media_id;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : '未知错误';
            new Notice(`创建草稿失败: ${errorMsg}`);
            throw error;
        }
    }

    /**
     * 从预览元素中提取文章数据并创建草稿
     * @param previewEl 预览元素
     * @param title 文章标题
     * @param author 作者
     * @param thumbMediaId 封面图片 media_id
     */
    async createDraftFromPreview(
        previewEl: HTMLElement,
        title: string,
        author: string,
        thumbMediaId?: string
    ): Promise<string> {
        // 提取内容区域
        const contentSection = previewEl.querySelector('.mp-content-section');
        if (!contentSection) {
            throw new Error('找不到内容区域');
        }

        // 清理 HTML（移除 data-* 属性）
        const cleanHtml = this.cleanHtml(contentSection as HTMLElement);

        // 提取摘要（前100个字符）
        const textContent = contentSection.textContent || '';
        const digest = textContent.substring(0, 100);

        // 构建文章数据
        const article: DraftArticle = {
            title: title || '未命名文章',
            author: author || '匿名',
            digest: digest,
            content: cleanHtml,
            thumb_media_id: thumbMediaId || '',
            show_cover_pic: thumbMediaId ? 1 : 0,
            need_open_comment: 1,
            only_fans_can_comment: 0
        };

        return this.createDraft(article);
    }

    /**
     * 清理 HTML，移除不必要的属性
     */
    private cleanHtml(element: HTMLElement): string {
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
     * 从文件路径提取标题
     */
    extractTitleFromPath(filePath: string): string {
        const parts = filePath.split('/');
        const fileName = parts[parts.length - 1];
        return fileName.replace(/\.md$/, '');
    }
}
