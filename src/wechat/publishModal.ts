import { Notice } from 'obsidian';
import type { WeChatAccount } from '../settings/settings';
import { WeChatPublisher } from './weChatPublisher';

/**
 * 发布类型枚举
 */
export enum PublishType {
    Article = 'article',      // 公众号文章
    XiaoLvShu = 'xiaolvshu'   // 小绿书（暂未实现）
}

/**
 * 发布弹窗组件
 * 参考 UI 设计，提供文章标题、公众号选择、发布类型选择
 * 不继承 Modal 类，完全自定义实现
 */
export class PublishModal {
    private app: any;
    private previewEl: HTMLElement;
    private filePath: string;
    private accounts: WeChatAccount[];
    private selectedAccountId: string | undefined;
    private publishType: PublishType = PublishType.Article;
    private articleTitle: string;

    // UI 元素
    private modalEl: HTMLElement;
    private titleInput: HTMLInputElement;
    private accountSelect: HTMLSelectElement;
    private publishButton: HTMLButtonElement;
    private escapeHandler: (e: KeyboardEvent) => void;

    constructor(
        app: any,
        previewEl: HTMLElement,
        filePath: string,
        accounts: WeChatAccount[]
    ) {
        this.app = app;
        this.previewEl = previewEl;
        this.filePath = filePath;
        this.accounts = accounts;

        // 提取默认标题
        this.articleTitle = this.extractTitleFromPath(filePath);

        // 获取默认选中的账号
        const defaultAccount = accounts.find(acc => acc.isDefault);
        this.selectedAccountId = defaultAccount?.id;
    }

    /**
     * 打开弹窗
     */
    open() {
        // 找到预览区域的容器
        const previewContainer = this.previewEl.closest('.mp-view-content') as HTMLElement;
        if (!previewContainer) {
            new Notice('无法找到预览容器');
            return;
        }

        // 创建弹窗容器
        this.modalEl = document.createElement('div');
        this.modalEl.className = 'mp-publish-modal-container';
        this.modalEl.style.cssText = `
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            max-width: 480px;
            width: calc(100% - 40px);
            max-height: calc(100% - 40px);
            z-index: 1000;
            background: var(--background-primary);
            border-radius: 16px;
            box-shadow:
                0 12px 48px rgba(0, 0, 0, 0.2),
                0 4px 16px rgba(0, 0, 0, 0.1);
            overflow-y: auto;
            display: flex;
            flex-direction: column;
        `;

        // 创建内容
        this.createContent();

        // 添加到容器
        previewContainer.appendChild(this.modalEl);

        // 注册 ESC 键关闭
        this.escapeHandler = this.handleEscape.bind(this);
        document.addEventListener('keydown', this.escapeHandler);
    }

    /**
     * 关闭弹窗
     */
    close() {
        if (this.modalEl && this.modalEl.parentElement) {
            this.modalEl.parentElement.removeChild(this.modalEl);
        }

        // 移除 ESC 键监听
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
        }
    }

    /**
     * 处理 ESC 键
     */
    private handleEscape(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            this.close();
        }
    }

    /**
     * 创建弹窗内容
     */
    private createContent() {
        // 标题栏
        const header = this.modalEl.createEl('div', {
            cls: 'mp-modal-header'
        });
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px 16px;
            border-bottom: 2px solid var(--background-modifier-border);
        `;

        const title = header.createEl('h2', {
            text: '发布到公众号',
            cls: 'mp-modal-title'
        });
        title.style.cssText = `
            font-size: 20px;
            font-weight: 600;
            color: var(--text-normal);
            margin: 0;
            flex: 1;
            text-align: center;
        `;

        // 关闭按钮
        const closeButton = header.createEl('button', {
            cls: 'mp-modal-close-btn',
            text: '✕'
        });
        closeButton.style.cssText = `
            position: absolute;
            top: 16px;
            right: 16px;
            width: 32px;
            height: 32px;
            border: none;
            background: transparent;
            color: var(--text-muted);
            font-size: 20px;
            cursor: pointer;
            border-radius: 6px;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            line-height: 1;
        `;
        closeButton.addEventListener('click', () => this.close());
        closeButton.addEventListener('mouseenter', () => {
            closeButton.style.background = 'var(--background-modifier-hover)';
            closeButton.style.color = 'var(--text-normal)';
        });
        closeButton.addEventListener('mouseleave', () => {
            closeButton.style.background = 'transparent';
            closeButton.style.color = 'var(--text-muted)';
        });

        // 内容区域
        const content = this.modalEl.createEl('div', {
            cls: 'mp-modal-content'
        });
        content.style.cssText = `
            padding: 24px;
            overflow-y: auto;
        `;

        // 文章标题
        this.createField(content, '文章标题', 'text', this.articleTitle, (value) => {
            this.articleTitle = value;
        }, '请输入文章标题');

        // 公众号选择
        if (this.accounts.length === 0) {
            this.createField(content, '选择公众号', 'empty', '', () => {}, '暂无公众号，请先在设置中添加');
        } else {
            const selectWrapper = this.createField(content, '选择公众号', 'select', this.selectedAccountId || this.accounts[0].id, (value) => {
                this.selectedAccountId = value;
            }, '');

            const selectEl = selectWrapper.createEl('select');
            selectEl.style.cssText = `
                width: 100%;
                padding: 10px 12px;
                border: 1px solid var(--background-modifier-border);
                border-radius: 8px;
                background: var(--background-primary);
                color: var(--text-normal);
                font-size: 14px;
                min-height: 40px;
                transition: all 0.2s ease;
                cursor: pointer;
            `;
            selectEl.addEventListener('mouseenter', () => {
                selectEl.style.borderColor = 'var(--interactive-accent)';
            });
            selectEl.addEventListener('mouseleave', () => {
                selectEl.style.borderColor = 'var(--background-modifier-border)';
            });

            this.accounts.forEach(account => {
                const option = selectEl.createEl('option', {
                    value: account.id,
                    text: account.name
                });
                if (account.id === (this.selectedAccountId || this.accounts[0].id)) {
                    option.selected = true;
                }
            });

            this.accountSelect = selectEl;
            selectEl.addEventListener('change', () => {
                this.selectedAccountId = selectEl.value;
            });
        }

        // 发布类型
        this.createField(content, '发布类型', 'readonly', '📰 公众号文章', () => {}, '');

        // 提示信息
        const hint = content.createEl('div', {
            text: '💡 文章将发布到公众号草稿箱，您可以在公众号后台进行进一步编辑和发布'
        });
        hint.style.cssText = `
            padding: 14px 16px;
            background: linear-gradient(
                135deg,
                var(--background-secondary) 0%,
                var(--background-primary) 100%
            );
            border-radius: 10px;
            margin-top: 12px;
            font-size: 13px;
            color: var(--text-muted);
            border: 1px solid var(--background-modifier-border);
            line-height: 1.6;
        `;

        // 底部按钮
        const footer = content.createDiv();
        footer.style.cssText = 'display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--background-modifier-border);';

        const cancelButton = footer.createEl('button', { text: '取消' });
        cancelButton.style.cssText = `
            padding: 10px 20px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 8px;
            background: var(--background-primary);
            color: var(--text-normal);
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s ease;
        `;
        cancelButton.addEventListener('click', () => this.close());
        cancelButton.addEventListener('mouseenter', () => {
            cancelButton.style.background = 'var(--background-modifier-hover)';
            cancelButton.style.transform = 'translateY(-1px)';
        });
        cancelButton.addEventListener('mouseleave', () => {
            cancelButton.style.background = 'var(--background-primary)';
            cancelButton.style.transform = 'translateY(0)';
        });

        this.publishButton = footer.createEl('button', {
            text: '🚀 发布'
        });
        this.publishButton.style.cssText = `
            padding: 10px 24px;
            border: none;
            border-radius: 8px;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: #ffffff;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(245, 87, 108, 0.3);
            transition: all 0.3s ease;
        `;
        this.publishButton.addEventListener('click', () => this.handlePublish());
        this.publishButton.addEventListener('mouseenter', () => {
            this.publishButton.style.background = 'linear-gradient(135deg, #e080eb 0%, #e04a5f 100%)';
            this.publishButton.style.transform = 'translateY(-2px) scale(1.02)';
            this.publishButton.style.boxShadow = '0 6px 20px rgba(245, 87, 108, 0.4)';
        });
        this.publishButton.addEventListener('mouseleave', () => {
            this.publishButton.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
            this.publishButton.style.transform = 'translateY(0) scale(1)';
            this.publishButton.style.boxShadow = '0 4px 12px rgba(245, 87, 108, 0.3)';
        });
    }

    /**
     * 创建表单字段
     */
    private createField(
        container: HTMLElement,
        label: string,
        type: 'text' | 'select' | 'empty' | 'readonly',
        value: string,
        onChange: (value: string) => void,
        placeholder: string
    ): HTMLElement {
        const field = container.createDiv();
        field.style.cssText = 'margin-bottom: 20px;';

        // 标签
        const labelEl = field.createEl('label', {
            text: label
        });
        labelEl.style.cssText = 'display: block; font-size: 13px; font-weight: 500; color: var(--text-normal); margin-bottom: 8px;';

        if (type === 'empty') {
            const descEl = field.createEl('div', {
                text: placeholder
            });
            descEl.style.cssText = 'padding: 8px 12px; color: var(--text-muted); font-size: 14px; background: var(--background-secondary); border-radius: 4px;';
            return field;
        }

        if (type === 'readonly') {
            const descEl = field.createEl('div', {
                text: value
            });
            descEl.style.cssText = 'padding: 8px 12px; color: var(--text-normal); font-size: 14px;';
            return field;
        }

        if (type === 'text') {
            const inputEl = field.createEl('input', {
                type: 'text',
                value: value,
                placeholder: placeholder
            });
            inputEl.style.cssText = `
                width: 100%;
                padding: 10px 12px;
                border: 1px solid var(--background-modifier-border);
                border-radius: 8px;
                background: var(--background-primary);
                color: var(--text-normal);
                font-size: 14px;
                box-sizing: border-box;
                transition: all 0.2s ease;
            `;
            inputEl.addEventListener('input', () => {
                onChange(inputEl.value);
            });
            inputEl.addEventListener('focus', () => {
                inputEl.style.borderColor = 'var(--interactive-accent)';
                inputEl.style.boxShadow = '0 0 0 3px rgba(var(--rgb-accent), 0.1)';
            });
            inputEl.addEventListener('blur', () => {
                inputEl.style.borderColor = 'var(--background-modifier-border)';
                inputEl.style.boxShadow = 'none';
            });
            this.titleInput = inputEl;
        }

        if (type === 'select') {
            // 返回容器，让调用者添加 select 元素
            const wrapper = field.createDiv();
            wrapper.style.cssText = 'width: 100%;';
            return wrapper;
        }

        return field;
    }

    /**
     * 处理发布
     */
    private async handlePublish() {
        // 验证输入
        if (!this.articleTitle.trim()) {
            new Notice('请输入文章标题');
            this.titleInput.focus();
            return;
        }

        if (!this.selectedAccountId) {
            new Notice('请选择公众号');
            return;
        }

        if (this.accounts.length === 0) {
            new Notice('暂无公众号，请先在设置中添加');
            return;
        }

        // 禁用按钮，防止重复点击
        this.publishButton.disabled = true;
        this.publishButton.setText('发布中...');

        try {
            // 获取选中的账号
            const account = this.accounts.find(acc => acc.id === this.selectedAccountId);
            if (!account) {
                throw new Error('未找到选中的公众号账号');
            }

            // 初始化发布器并发布
            WeChatPublisher.initialize(account);
            await WeChatPublisher.publish(this.previewEl, this.articleTitle, this.app);

            // 发布成功，关闭弹窗
            setTimeout(() => {
                this.close();
            }, 1500);

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : '发布失败';
            new Notice(`发布失败: ${errorMsg}`);

            // 恢复按钮状态
            this.publishButton.disabled = false;
            this.publishButton.setText('发布');
        }
    }

    /**
     * 从文件路径提取标题
     */
    private extractTitleFromPath(filePath: string): string {
        const parts = filePath.split('/');
        const fileName = parts[parts.length - 1];
        return fileName.replace(/\.md$/, '');
    }
}
