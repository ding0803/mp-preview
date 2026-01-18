import { App, Modal, Notice, Setting } from 'obsidian';
import type { WeChatAccount } from '../settings';

/**
 * 微信公众号账号配置弹窗
 * 用于添加和编辑微信公众号账号
 */
export class WeChatAccountModal extends Modal {
    private account: WeChatAccount | null;
    private onSubmit: (account: Omit<WeChatAccount, 'id'>) => void;
    private nameInput: HTMLInputElement;
    private appIdInput: HTMLInputElement;
    private appSecretInput: HTMLInputElement;

    constructor(
        app: App,
        onSubmit: (account: Omit<WeChatAccount, 'id'>) => void,
        existingAccount?: WeChatAccount
    ) {
        super(app);
        this.account = existingAccount || null;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        this.titleEl.setText(this.account ? '编辑公众号账号' : '添加公众号账号');
        this.contentEl.empty();

        // 使用原生 Setting 组件
        new Setting(this.contentEl)
            .setName('公众号名称')
            .setDesc('用于标识你的公众号')
            .addText(text => {
                text.setPlaceholder('例如：我的公众号')
                    .setValue(this.account?.name || '');
                this.nameInput = text.inputEl;
            });

        new Setting(this.contentEl)
            .setName('AppID')
            .setDesc('在微信公众平台 > 开发 > 基本配置中获取')
            .addText(text => {
                text.setPlaceholder('wxXXXXXXXXXXXXXXXXXX')
                    .setValue(this.account?.appId || '');
                this.appIdInput = text.inputEl;
            });

        new Setting(this.contentEl)
            .setName('AppSecret')
            .setDesc('在微信公众平台 > 开发 > 基本配置中获取')
            .addText(text => {
                text.inputEl.type = 'password';
                text.setPlaceholder('••••••••••••••••')
                    .setValue(this.account?.appSecret || '');
                this.appSecretInput = text.inputEl;
            });

        // 帮助信息
        const helpSection = this.contentEl.createDiv();
        helpSection.createEl('h4', { text: '如何获取 AppID 和 AppSecret？' });
        helpSection.createEl('p', { text: '1. 登录微信公众平台（mp.weixin.qq.com）' });
        helpSection.createEl('p', { text: '2. 进入「开发」>「基本配置」' });
        helpSection.createEl('p', { text: '3. 在「开发者ID」中查看 AppID 和 AppSecret' });
        helpSection.createEl('p', { text: '4. 首次获取需要管理员扫码验证' });
        helpSection.style.marginTop = '20px';
        helpSection.style.padding = '12px';
        helpSection.style.background = 'var(--background-secondary)';
        helpSection.style.borderRadius = '8px';

        // 按钮区域
        const footer = this.contentEl.createDiv();
        footer.style.display = 'flex';
        footer.style.justifyContent = 'flex-end';
        footer.style.gap = '12px';
        footer.style.marginTop = '20px';

        const cancelButton = footer.createEl('button', { text: '取消' });
        cancelButton.addEventListener('click', () => this.close());

        const submitButton = footer.createEl('button', {
            text: this.account ? '保存' : '添加',
            cls: 'mod-cta'
        });
        submitButton.addEventListener('click', () => this.handleSubmit());
    }

    /**
     * 处理表单提交
     */
    private handleSubmit() {
        const name = this.nameInput.value.trim();
        const appId = this.appIdInput.value.trim();
        const appSecret = this.appSecretInput.value.trim();

        // 验证输入
        if (!name) {
            new Notice('请输入公众号名称');
            this.nameInput.focus();
            return;
        }

        if (!appId) {
            new Notice('请输入 AppID');
            this.appIdInput.focus();
            return;
        }

        if (!appSecret) {
            new Notice('请输入 AppSecret');
            this.appSecretInput.focus();
            return;
        }

        // 验证 AppID 格式（以 wx 开头，长度为 18）
        if (!/^wx[a-z0-9]{16}$/.test(appId)) {
            new Notice('AppID 格式不正确，应以 wx 开头且长度为 18 位');
            this.appIdInput.focus();
            return;
        }

        // 验证 AppSecret 格式（长度为 32）
        if (appSecret.length !== 32) {
            new Notice('AppSecret 长度应为 32 位');
            this.appSecretInput.focus();
            return;
        }

        // 提交数据
        this.onSubmit({
            name,
            appId,
            appSecret,
            isDefault: this.account?.isDefault || false
        });

        this.close();
    }

    onClose() {
        this.contentEl.empty();
    }
}
