import { Notice } from 'obsidian';
import { WeChatConfig, AccessTokenResponse } from './types';

/**
 * 微信公众号认证服务
 * 负责 access_token 的获取和管理
 */
export class WeChatAuthService {
    private config: WeChatConfig;

    constructor(config: WeChatConfig) {
        this.config = config;
    }

    /**
     * 检查 token 是否有效
     */
    isTokenValid(): boolean {
        if (!this.config.accessToken || !this.config.tokenExpireTime) {
            return false;
        }
        // 提前 5 分钟过期，避免边界情况
        const now = Date.now();
        const expireTime = this.config.tokenExpireTime - 5 * 60 * 1000;
        return now < expireTime;
    }

    /**
     * 获取 access_token
     * 如果当前 token 有效则直接返回，否则重新获取
     */
    async getAccessToken(): Promise<string> {
        if (this.isTokenValid() && this.config.accessToken) {
            return this.config.accessToken;
        }

        return this.refreshAccessToken();
    }

    /**
     * 刷新 access_token
     * 调用微信 API 获取新的 token
     */
    private async refreshAccessToken(): Promise<string> {
        const { appId, appSecret } = this.config;

        if (!appId || !appSecret) {
            throw new Error('微信 AppID 或 AppSecret 未配置');
        }

        const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;

        try {
            const response = await fetch(url);
            const data: AccessTokenResponse = await response.json();

            if (data.errcode && data.errcode !== 0) {
                throw new Error(`获取 access_token 失败: ${data.errmsg}`);
            }

            if (!data.access_token) {
                throw new Error('获取 access_token 失败: 响应中没有 access_token');
            }

            // 更新配置
            this.config.accessToken = data.access_token;
            this.config.tokenExpireTime = Date.now() + data.expires_in * 1000;

            new Notice('微信 access_token 刷新成功');
            return data.access_token;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : '未知错误';
            new Notice(`获取 access_token 失败: ${errorMsg}`);
            throw error;
        }
    }

    /**
     * 更新配置
     */
    updateConfig(config: Partial<WeChatConfig>) {
        this.config = { ...this.config, ...config };
    }

    /**
     * 获取当前配置
     */
    getConfig(): WeChatConfig {
        return { ...this.config };
    }
}
