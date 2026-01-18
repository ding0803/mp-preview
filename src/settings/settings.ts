import { Template } from '../templateManager';
import { Background } from '../backgroundManager';

// 微信公众号账号配置
export interface WeChatAccount {
    id: string;
    name: string;
    appId: string;
    appSecret: string;
    isDefault?: boolean;
}

interface MPSettings {
    backgroundId: string;
    templateId: string;
    fontFamily: string;
    fontSize: number;
    templates: Template[];
    customTemplates: Template[];
    backgrounds: Background[];
    customBackgrounds: Background[];
    customFonts: { value: string; label: string; isPreset?: boolean }[];
    wechatAccounts: WeChatAccount[];
    selectedWechatAccountId?: string;
}

const DEFAULT_SETTINGS: MPSettings = {
    backgroundId: 'default',
    templateId: 'default',
    fontFamily: '-apple-system',
    fontSize: 16,
    templates: [],
    customTemplates: [],
    backgrounds: [],
    customBackgrounds: [],
    customFonts: [
        {
            value: 'Optima-Regular, Optima, PingFangSC-light, PingFangTC-light, "PingFang SC", Cambria, Cochin, Georgia, Times, "Times New Roman", serif',
            label: '默认字体',
            isPreset: true
        },
        { value: 'SimSun, "宋体", serif', label: '宋体', isPreset: true },
        { value: 'SimHei, "黑体", sans-serif', label: '黑体', isPreset: true },
        { value: 'KaiTi, "楷体", serif', label: '楷体', isPreset: true },
        { value: '"Microsoft YaHei", "微软雅黑", sans-serif', label: '雅黑', isPreset: true }
    ],
    wechatAccounts: [],
    selectedWechatAccountId: undefined,
};

export class SettingsManager {
    private plugin: any;
    private settings: MPSettings;

    constructor(plugin: any) {
        this.plugin = plugin;
        this.settings = DEFAULT_SETTINGS;
    }

    async loadSettings() {
        let savedData = await this.plugin.loadData();
        if (!savedData) {
            savedData = {};
        }
        if (!savedData.templates || savedData.templates.length === 0) {
            const { templates } = await import('../templates');
            savedData.templates = Object.values(templates).map(template => ({
                ...template,
                isPreset: true,
                isVisible: true  // 默认可见
            }));
        }
        if (!savedData.customTemplates) {
            savedData.customTemplates = [];
        }
        if (!savedData.customFonts) {
            savedData.customFonts = DEFAULT_SETTINGS.customFonts;
        }
        // 加载背景设置 - 始终同步预设背景
        const { backgrounds } = await import('../backgrounds');
        const presetBackgrounds = backgrounds.backgrounds.map(background => ({
            ...background,
            isPreset: true,
            isVisible: true
        }));

        if (!savedData.backgrounds || savedData.backgrounds.length === 0) {
            // 首次加载，直接使用所有预设背景
            savedData.backgrounds = presetBackgrounds;
        } else {
            // 已有背景数据，同步新的预设背景
            const existingIds = new Set(savedData.backgrounds.filter((b: Background) => b.isPreset).map((b: Background) => b.id));
            const newPresets = presetBackgrounds.filter((pb: Background) => !existingIds.has(pb.id));

            if (newPresets.length > 0) {
                // 添加新的预设背景
                savedData.backgrounds = [...savedData.backgrounds, ...newPresets];
            }

            // 确保所有预设背景都有正确的 isPreset 标记
            savedData.backgrounds = savedData.backgrounds.map((b: Background) => {
                const presetMatch = presetBackgrounds.find((pb: Background) => pb.id === b.id);
                if (presetMatch) {
                    return { ...b, isPreset: true };
                }
                return b;
            });
        }
        if (!savedData.customBackgrounds) {
            savedData.customBackgrounds = [];
        }
        if (!savedData.customFonts) {
            savedData.customFonts = DEFAULT_SETTINGS.customFonts;
        }
        // 加载微信账号配置
        if (!savedData.wechatAccounts) {
            savedData.wechatAccounts = [];
        }
        this.settings = Object.assign({}, DEFAULT_SETTINGS, savedData);
    }

    getAllTemplates(): Template[] {
        return [...this.settings.templates, ...this.settings.customTemplates];
    }

    getVisibleTemplates(): Template[] {
        return this.getAllTemplates().filter(template => template.isVisible !== false);
    }

    getTemplate(templateId: string): Template | undefined {
        return this.settings.templates.find(template => template.id === templateId)
            || this.settings.customTemplates.find(template => template.id === templateId);
    }

    async addCustomTemplate(template: Template) {
        template.isPreset = false;
        template.isVisible = true;  // 默认可见
        this.settings.customTemplates.push(template);
        await this.saveSettings();
    }

    async updateTemplate(templateId: string, updatedTemplate: Partial<Template>) {
        const presetTemplateIndex = this.settings.templates.findIndex(t => t.id === templateId);
        if (presetTemplateIndex !== -1) {
            this.settings.templates[presetTemplateIndex] = {
                ...this.settings.templates[presetTemplateIndex],
                ...updatedTemplate
            };
            await this.saveSettings();
            return true;
        }

        const customTemplateIndex = this.settings.customTemplates.findIndex(t => t.id === templateId);
        if (customTemplateIndex !== -1) {
            this.settings.customTemplates[customTemplateIndex] = {
                ...this.settings.customTemplates[customTemplateIndex],
                ...updatedTemplate
            };
            await this.saveSettings();
            return true;
        }

        return false;
    }

    async removeTemplate(templateId: string): Promise<boolean> {
        const template = this.getTemplate(templateId);
        if (template && !template.isPreset) {
            this.settings.customTemplates = this.settings.customTemplates.filter(t => t.id !== templateId);
            if (this.settings.templateId === templateId) {
                this.settings.templateId = 'default';
            }
            await this.saveSettings();
            return true;
        }
        return false;
    }

    async saveSettings() {
        await this.plugin.saveData(this.settings);
    }

    getSettings(): MPSettings {
        return this.settings;
    }

    async updateSettings(settings: Partial<MPSettings>) {
        this.settings = { ...this.settings, ...settings };
        await this.saveSettings();
    }

    getFontOptions() {
        return this.settings.customFonts;
    }

    async addCustomFont(font: { value: string; label: string }) {
        this.settings.customFonts.push({ ...font, isPreset: false });
        await this.saveSettings();
    }

    async removeFont(value: string) {
        const font = this.settings.customFonts.find(f => f.value === value);
        if (font && !font.isPreset) {
            this.settings.customFonts = this.settings.customFonts.filter(f => f.value !== value);
            await this.saveSettings();
        }
    }

    async updateFont(oldValue: string, newFont: { value: string; label: string }) {
        const index = this.settings.customFonts.findIndex(f => f.value === oldValue);
        if (index !== -1 && !this.settings.customFonts[index].isPreset) {
            this.settings.customFonts[index] = { ...newFont, isPreset: false };
            await this.saveSettings();
        }
    }

    // 背景相关方法
    getAllBackgrounds(): Background[] {
        return [...this.settings.backgrounds, ...this.settings.customBackgrounds];
    }

    getVisibleBackgrounds(): Background[] {
        return this.getAllBackgrounds().filter(background => background.isVisible !== false);
    }

    getBackground(backgroundId: string): Background | undefined {
        return this.settings.backgrounds.find(background => background.id === backgroundId)
            || this.settings.customBackgrounds.find(background => background.id === backgroundId);
    }

    async addCustomBackground(background: Background) {
        background.isPreset = false;
        background.isVisible = true;  // 默认可见
        this.settings.customBackgrounds.push(background);
        await this.saveSettings();
    }

    async updateBackground(backgroundId: string, updatedBackground: Partial<Background>) {
        const presetBackgroundIndex = this.settings.backgrounds.findIndex(b => b.id === backgroundId);
        if (presetBackgroundIndex !== -1) {
            this.settings.backgrounds[presetBackgroundIndex] = {
                ...this.settings.backgrounds[presetBackgroundIndex],
                ...updatedBackground
            };
            await this.saveSettings();
            return true;
        }

        const customBackgroundIndex = this.settings.customBackgrounds.findIndex(b => b.id === backgroundId);
        if (customBackgroundIndex !== -1) {
            this.settings.customBackgrounds[customBackgroundIndex] = {
                ...this.settings.customBackgrounds[customBackgroundIndex],
                ...updatedBackground
            };
            await this.saveSettings();
            return true;
        }

        return false;
    }

    async removeBackground(backgroundId: string): Promise<boolean> {
        const background = this.getBackground(backgroundId);
        if (background && !background.isPreset) {
            this.settings.customBackgrounds = this.settings.customBackgrounds.filter(b => b.id !== backgroundId);
            if (this.settings.backgroundId === backgroundId) {
                this.settings.backgroundId = 'default';
            }
            await this.saveSettings();
            return true;
        }
        return false;
    }

    // ========== 微信公众号账号管理 ==========

    /**
     * 获取所有微信账号
     */
    getWeChatAccounts(): WeChatAccount[] {
        return this.settings.wechatAccounts || [];
    }

    /**
     * 根据 ID 获取微信账号
     */
    getWeChatAccount(id: string): WeChatAccount | undefined {
        return this.settings.wechatAccounts?.find(acc => acc.id === id);
    }

    /**
     * 获取默认微信账号
     */
    getDefaultWeChatAccount(): WeChatAccount | undefined {
        return this.settings.wechatAccounts?.find(acc => acc.isDefault);
    }

    /**
     * 获取当前选中的微信账号
     */
    getSelectedWeChatAccount(): WeChatAccount | undefined {
        const selectedId = this.settings.selectedWechatAccountId;
        if (selectedId) {
            return this.getWeChatAccount(selectedId);
        }
        // 如果没有选中，返回默认账号
        return this.getDefaultWeChatAccount();
    }

    /**
     * 添加微信账号
     */
    async addWeChatAccount(account: Omit<WeChatAccount, 'id'>): Promise<WeChatAccount> {
        const { nanoid } = await import('nanoid');
        const newAccount: WeChatAccount = {
            ...account,
            id: nanoid(8)
        };

        if (!this.settings.wechatAccounts) {
            this.settings.wechatAccounts = [];
        }

        // 如果是第一个账号，设为默认
        if (this.settings.wechatAccounts.length === 0) {
            newAccount.isDefault = true;
        }

        this.settings.wechatAccounts.push(newAccount);
        await this.saveSettings();
        return newAccount;
    }

    /**
     * 更新微信账号
     */
    async updateWeChatAccount(id: string, updates: Partial<WeChatAccount>): Promise<boolean> {
        const index = this.settings.wechatAccounts?.findIndex(acc => acc.id === id);
        if (index === undefined || index === -1) {
            return false;
        }

        this.settings.wechatAccounts[index] = {
            ...this.settings.wechatAccounts[index],
            ...updates
        };

        await this.saveSettings();
        return true;
    }

    /**
     * 删除微信账号
     */
    async removeWeChatAccount(id: string): Promise<boolean> {
        const index = this.settings.wechatAccounts?.findIndex(acc => acc.id === id);
        if (index === undefined || index === -1) {
            return false;
        }

        this.settings.wechatAccounts.splice(index, 1);

        // 如果删除的是当前选中的账号，清空选中状态
        if (this.settings.selectedWechatAccountId === id) {
            this.settings.selectedWechatAccountId = undefined;
        }

        // 如果删除的是默认账号，设置第一个账号为默认
        const deletedWasDefault = this.settings.wechatAccounts[index]?.isDefault;
        if (deletedWasDefault && this.settings.wechatAccounts.length > 0) {
            this.settings.wechatAccounts[0].isDefault = true;
        }

        await this.saveSettings();
        return true;
    }

    /**
     * 设置默认微信账号
     */
    async setDefaultWeChatAccount(id: string): Promise<boolean> {
        // 取消所有账号的默认状态
        this.settings.wechatAccounts?.forEach(acc => {
            acc.isDefault = (acc.id === id);
        });

        await this.saveSettings();
        return true;
    }

    /**
     * 设置当前选中的微信账号
     */
    async setSelectedWeChatAccount(id: string): Promise<void> {
        this.settings.selectedWechatAccountId = id;
        await this.saveSettings();
    }
}