/**
 * 微信公众号 API 类型定义
 */

// 微信配置接口
export interface WeChatConfig {
    appId: string;
    appSecret: string;
    accessToken?: string;
    tokenExpireTime?: number;
}

// Token 响应
export interface AccessTokenResponse {
    access_token: string;
    expires_in: number;
    errcode?: number;
    errmsg?: string;
}

// 通用 API 响应
export interface WeChatApiResponse {
    errcode: number;
    errmsg: string;
}

// 图片上传响应
export interface MediaUploadResponse extends WeChatApiResponse {
    type: string;
    media_id: string;
    url: string;
}

// 草稿文章项
export interface DraftArticle {
    title: string;
    author: string;
    digest: string;
    content: string;
    content_source_url?: string;
    thumb_media_id: string;
    show_cover_pic: number;
    need_open_comment?: number;
    only_fans_can_comment?: number;
}

// 创建草稿响应
export interface DraftCreateResponse extends WeChatApiResponse {
    media_id: string;
}
