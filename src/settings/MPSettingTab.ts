import { App, PluginSettingTab, Setting, setIcon, Notice } from 'obsidian';
import MPPlugin from '../main'; // 修改插件名以匹配类名
import { CreateTemplateModal } from './CreateTemplateModal';
import { CreateFontModal } from './CreateFontModal';
import { CreateBackgroundModal } from './CreateBackgroundModal'; // 添加导入
import { ConfirmModal } from './ConfirmModal';
import { TemplatePreviewModal }  from './templatePreviewModal'; // 添加导入
import { WeChatAccountModal } from './wechat/WeChatAccountModal'; // 添加导入
export class MPSettingTab extends PluginSettingTab {
    plugin: MPPlugin; // 修改插件类型以匹配类名
    private expandedSections: Set<string> = new Set();

    constructor(app: App, plugin: MPPlugin) { // 修改插件类型以匹配类名
        super(app, plugin);
        this.plugin = plugin;
    }

    private createSection(containerEl: HTMLElement, title: string, renderContent: (contentEl: HTMLElement) => void) {
        const section = containerEl.createDiv('settings-section');
        const header = section.createDiv('settings-section-header');

        const toggle = header.createSpan('settings-section-toggle');
        setIcon(toggle, 'chevron-right');

        header.createEl('h4', { text: title });

        const content = section.createDiv('settings-section-content');
        renderContent(content);

        header.addEventListener('click', () => {
            const isExpanded = !section.hasClass('is-expanded');
            section.toggleClass('is-expanded', isExpanded);
            setIcon(toggle, isExpanded ? 'chevron-down' : 'chevron-right');
            if (isExpanded) {
                this.expandedSections.add(title);
            } else {
                this.expandedSections.delete(title);
            }
        });

        if (this.expandedSections.has(title) || (!containerEl.querySelector('.settings-section'))) {
            section.addClass('is-expanded');
            setIcon(toggle, 'chevron-down');
            this.expandedSections.add(title);
        }

        return section;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass('mp-settings');

        containerEl.createEl('h2', { text: 'MP Preview' });

        this.createSection(containerEl, '基本选项', el => this.renderBasicSettings(el));
        this.createSection(containerEl, '模板选项', el => this.renderTemplateSettings(el));
        this.createSection(containerEl, '背景选项', el => this.renderBackgroundSettings(el));
        this.createSection(containerEl, '微信公众号', el => this.renderWeChatSettings(el));
    }

    private renderBasicSettings(containerEl: HTMLElement): void {
        // 字体管理区域
        const fontSection = containerEl.createDiv('mp-settings-subsection');
        const fontHeader = fontSection.createDiv('mp-settings-subsection-header');
        const fontToggle = fontHeader.createSpan('mp-settings-subsection-toggle');
        setIcon(fontToggle, 'chevron-right');

        fontHeader.createEl('h3', { text: '字体管理' });

        const fontContent = fontSection.createDiv('mp-settings-subsection-content');

        // 折叠/展开逻辑
        fontHeader.addEventListener('click', () => {
            const isExpanded = !fontSection.hasClass('is-expanded');
            fontSection.toggleClass('is-expanded', isExpanded);
            setIcon(fontToggle, isExpanded ? 'chevron-down' : 'chevron-right');
        });

        // 字体列表
        const fontList = fontContent.createDiv('font-management');
        this.plugin.settingsManager.getFontOptions().forEach(font => {
            const fontItem = fontList.createDiv('font-item');
            const setting = new Setting(fontItem)
                .setName(font.label)
                .setDesc(font.value);

            // 只为非预设字体添加编辑和删除按钮
            if (!font.isPreset) {
                setting
                    .addExtraButton(btn =>
                        btn.setIcon('pencil')
                            .setTooltip('编辑')
                            .onClick(() => {
                                new CreateFontModal(
                                    this.app,
                                    async (updatedFont) => {
                                        await this.plugin.settingsManager.updateFont(font.value, updatedFont);
                                        this.display();
                                        new Notice('请重启 Obsidian 或重新加载以使更改生效');
                                    },
                                    font
                                ).open();
                            }))
                    .addExtraButton(btn =>
                        btn.setIcon('trash')
                            .setTooltip('删除')
                            .onClick(() => {
                                // 新增确认模态框
                                new ConfirmModal(
                                    this.app,
                                    '确认删除字体',
                                    `确定要删除「${font.label}」字体配置吗？`,
                                    async () => {
                                        await this.plugin.settingsManager.removeFont(font.value);
                                        this.display();
                                        new Notice('请重启 Obsidian 或重新加载以使更改生效');
                                    }
                                ).open();
                            }));
            }
        });

        // 添加新字体按钮
        new Setting(fontContent)
            .addButton(btn => btn
                .setButtonText('+ 添加字体')
                .setCta()
                .onClick(() => {
                    new CreateFontModal(
                        this.app,
                        async (newFont) => {
                            await this.plugin.settingsManager.addCustomFont(newFont);
                            this.display();
                            new Notice('请重启 Obsidian 或重新加载以使更改生效');
                        }
                    ).open();
                }));
    }

    private renderTemplateSettings(containerEl: HTMLElement): void {
        // 模板显示设置部分 - 从基本设置移动到这里
        const templateVisibilitySection = containerEl.createDiv('mp-settings-subsection');
        const templateVisibilityHeader = templateVisibilitySection.createDiv('mp-settings-subsection-header');

        const templateVisibilityToggle = templateVisibilityHeader.createSpan('mp-settings-subsection-toggle');
        setIcon(templateVisibilityToggle, 'chevron-right');

        templateVisibilityHeader.createEl('h3', { text: '模板显示选项' });

        const templateVisibilityContent = templateVisibilitySection.createDiv('mp-settings-subsection-content');

        // 折叠/展开逻辑
        templateVisibilityHeader.addEventListener('click', () => {
            const isExpanded = !templateVisibilitySection.hasClass('is-expanded');
            templateVisibilitySection.toggleClass('is-expanded', isExpanded);
            setIcon(templateVisibilityToggle, isExpanded ? 'chevron-down' : 'chevron-right');
        });

        // 模板选择容器
        const templateSelectionContainer = templateVisibilityContent.createDiv('template-selection-container');

        // 左侧：所有模板列表
        const allTemplatesContainer = templateSelectionContainer.createDiv('all-templates-container');
        allTemplatesContainer.createEl('h4', { text: '隐藏模板' });
        const allTemplatesList = allTemplatesContainer.createDiv('templates-list');

        // 中间：控制按钮
        const controlButtonsContainer = templateSelectionContainer.createDiv('control-buttons-container');
        const addButton = controlButtonsContainer.createEl('button', { text: '>' });
        const removeButton = controlButtonsContainer.createEl('button', { text: '<' });

        // 右侧：显示的模板列表
        const visibleTemplatesContainer = templateSelectionContainer.createDiv('visible-templates-container');
        visibleTemplatesContainer.createEl('h4', { text: '显示模板' });
        const visibleTemplatesList = visibleTemplatesContainer.createDiv('templates-list');

        // 获取所有模板
        const allTemplates = this.plugin.settingsManager.getAllTemplates();

        // 渲染模板列表
        const renderTemplateLists = () => {
            // 清空列表
            allTemplatesList.empty();
            visibleTemplatesList.empty();

            // 填充左侧列表（所有未显示的模板）
            allTemplates
                .filter(template => template.isVisible === false)
                .forEach(template => {
                    const templateItem = allTemplatesList.createDiv('template-list-item');
                    templateItem.textContent = template.name;
                    templateItem.dataset.templateId = template.id;

                    // 点击选中/取消选中
                    templateItem.addEventListener('click', () => {
                        templateItem.toggleClass('selected', !templateItem.hasClass('selected'));
                    });
                });

            // 填充右侧列表（所有显示的模板）
            allTemplates
                .filter(template => template.isVisible !== false) // 默认显示
                .forEach(template => {
                    const templateItem = visibleTemplatesList.createDiv('template-list-item');
                    templateItem.textContent = template.name;
                    templateItem.dataset.templateId = template.id;

                    // 点击选中/取消选中
                    templateItem.addEventListener('click', () => {
                        templateItem.toggleClass('selected', !templateItem.hasClass('selected'));
                    });
                });
        };

        // 初始渲染
        renderTemplateLists();

        // 添加按钮事件
        addButton.addEventListener('click', async () => {
            const selectedItems = Array.from(allTemplatesList.querySelectorAll('.template-list-item.selected'));
            if (selectedItems.length === 0) return;

            for (const item of selectedItems) {
                const templateId = (item as HTMLElement).dataset.templateId;
                if (!templateId) continue;

                const template = allTemplates.find(t => t.id === templateId);
                if (template) {
                    template.isVisible = true;
                    await this.plugin.settingsManager.updateTemplate(templateId, template);
                }
            }

            renderTemplateLists();
            new Notice('请重启 Obsidian 或重新加载以使更改生效');
        });

        // 移除按钮事件
        removeButton.addEventListener('click', async () => {
            const selectedItems = Array.from(visibleTemplatesList.querySelectorAll('.template-list-item.selected'));
            if (selectedItems.length === 0) return;

            for (const item of selectedItems) {
                const templateId = (item as HTMLElement).dataset.templateId;
                if (!templateId) continue;

                const template = allTemplates.find(t => t.id === templateId);
                if (template) {
                    template.isVisible = false;
                    await this.plugin.settingsManager.updateTemplate(templateId, template);
                }
            }

            renderTemplateLists();
            new Notice('请重启 Obsidian 或重新加载以使更改生效');
        });

        // 模板管理区域
        const templateList = containerEl.createDiv('template-management');
        // 渲染自定义模板
        templateList.createEl('h4', { text: '自定义模板', cls: 'template-custom-header' });
        this.plugin.settingsManager.getAllTemplates()
            .filter(template => !template.isPreset)
            .forEach(template => {
                const templateItem = templateList.createDiv('template-item');
                new Setting(templateItem)
                    .setName(template.name)
                    .setDesc(template.description)
                    .addExtraButton(btn => 
                        btn.setIcon('eye')
                            .setTooltip('预览')
                            .onClick(() => {
                                new TemplatePreviewModal(this.app, template, this.plugin.templateManager).open(); // 修改为使用预览模态框
                            }))
                    .addExtraButton(btn =>
                        btn.setIcon('pencil')
                            .setTooltip('编辑')
                            .onClick(() => {
                                new CreateTemplateModal(
                                    this.app,
                                    this.plugin,
                                    (updatedTemplate) => {
                                        this.plugin.settingsManager.updateTemplate(template.id, updatedTemplate);
                                        this.display();
                                        new Notice('请重启 Obsidian 或重新加载以使更改生效');
                                    },
                                    template
                                ).open();
                            }))
                    .addExtraButton(btn =>
                        btn.setIcon('trash')
                            .setTooltip('删除')
                            .onClick(() => {
                                // 新增确认模态框
                                new ConfirmModal(
                                    this.app,
                                    '确认删除模板',
                                    `确定要删除「${template.name}」模板吗？此操作不可恢复。`,
                                    async () => {
                                        await this.plugin.settingsManager.removeTemplate(template.id);
                                        this.display();
                                        new Notice('请重启 Obsidian 或重新加载以使更改生效');
                                    }
                                ).open();
                            }));
            });

        // 添加新模板按钮
        new Setting(containerEl)
            .addButton(btn => btn
                .setButtonText('+ 新建模板')
                .setCta()
                .onClick(() => {
                    new CreateTemplateModal(
                        this.app,
                        this.plugin,
                        async (newTemplate) => {
                            await this.plugin.settingsManager.addCustomTemplate(newTemplate);
                            this.display();
                            new Notice('请重启 Obsidian 或重新加载以使更改生效');
                        }
                    ).open();
                }));
    }

    private renderBackgroundSettings(containerEl: HTMLElement): void {
        // 背景显示设置部分
        const backgroundVisibilitySection = containerEl.createDiv('mp-settings-subsection');
        const backgroundVisibilityHeader = backgroundVisibilitySection.createDiv('mp-settings-subsection-header');

        const backgroundVisibilityToggle = backgroundVisibilityHeader.createSpan('mp-settings-subsection-toggle');
        setIcon(backgroundVisibilityToggle, 'chevron-right');

        backgroundVisibilityHeader.createEl('h3', { text: '背景显示' });

        const backgroundVisibilityContent = backgroundVisibilitySection.createDiv('mp-settings-subsection-content');

        // 折叠/展开逻辑
        backgroundVisibilityHeader.addEventListener('click', () => {
            const isExpanded = !backgroundVisibilitySection.hasClass('is-expanded');
            backgroundVisibilitySection.toggleClass('is-expanded', isExpanded);
            setIcon(backgroundVisibilityToggle, isExpanded ? 'chevron-down' : 'chevron-right');
        });

        // 背景选择容器
        const backgroundSelectionContainer = backgroundVisibilityContent.createDiv('background-selection-container');

        // 左侧：所有背景列表
        const allBackgroundsContainer = backgroundSelectionContainer.createDiv('all-backgrounds-container');
        allBackgroundsContainer.createEl('h4', { text: '隐藏背景' });
        const allBackgroundsList = allBackgroundsContainer.createDiv('backgrounds-list');

        // 中间：控制按钮
        const controlButtonsContainer = backgroundSelectionContainer.createDiv('control-buttons-container');
        const addButton = controlButtonsContainer.createEl('button', { text: '>' });
        const removeButton = controlButtonsContainer.createEl('button', { text: '<' });

        // 右侧：显示的背景列表
        const visibleBackgroundsContainer = backgroundSelectionContainer.createDiv('visible-backgrounds-container');
        visibleBackgroundsContainer.createEl('h4', { text: '显示背景' });
        const visibleBackgroundsList = visibleBackgroundsContainer.createDiv('backgrounds-list');

        // 获取所有背景
        const allBackgrounds = this.plugin.settingsManager.getAllBackgrounds();

        // 渲染背景列表
        const renderBackgroundLists = () => {
            // 清空列表
            allBackgroundsList.empty();
            visibleBackgroundsList.empty();

            // 填充左侧列表（所有未显示的背景）
            allBackgrounds
                .filter(background => background.isVisible === false)
                .forEach(background => {
                    const backgroundItem = allBackgroundsList.createDiv('background-list-item');
                    backgroundItem.textContent = background.name;
                    backgroundItem.dataset.backgroundId = background.id;

                    // 点击选中/取消选中
                    backgroundItem.addEventListener('click', () => {
                        backgroundItem.toggleClass('selected', !backgroundItem.hasClass('selected'));
                    });
                });

            // 填充右侧列表（所有显示的背景）
            allBackgrounds
                .filter(background => background.isVisible !== false) // 默认显示
                .forEach(background => {
                    const backgroundItem = visibleBackgroundsList.createDiv('background-list-item');
                    backgroundItem.textContent = background.name;
                    backgroundItem.dataset.backgroundId = background.id;

                    // 点击选中/取消选中
                    backgroundItem.addEventListener('click', () => {
                        backgroundItem.toggleClass('selected', !backgroundItem.hasClass('selected'));
                    });
                });
        };

        // 初始渲染
        renderBackgroundLists();

        // 添加按钮事件
        addButton.addEventListener('click', async () => {
            const selectedItems = Array.from(allBackgroundsList.querySelectorAll('.background-list-item.selected'));
            if (selectedItems.length === 0) return;

            for (const item of selectedItems) {
                const backgroundId = (item as HTMLElement).dataset.backgroundId;
                if (!backgroundId) continue;

                const background = allBackgrounds.find(b => b.id === backgroundId);
                if (background) {
                    background.isVisible = true;
                    await this.plugin.settingsManager.updateBackground(backgroundId, background);
                }
            }

            renderBackgroundLists();
            new Notice('背景显示设置已更新');
        });

        // 移除按钮事件
        removeButton.addEventListener('click', async () => {
            const selectedItems = Array.from(visibleBackgroundsList.querySelectorAll('.background-list-item.selected'));
            if (selectedItems.length === 0) return;

            for (const item of selectedItems) {
                const backgroundId = (item as HTMLElement).dataset.backgroundId;
                if (!backgroundId) continue;

                const background = allBackgrounds.find(b => b.id === backgroundId);
                if (background) {
                    background.isVisible = false;
                    await this.plugin.settingsManager.updateBackground(backgroundId, background);
                }
            }

            renderBackgroundLists();
            new Notice('背景显示已更新');
        });

        // 背景管理区域
        const backgroundList = containerEl.createDiv('background-management');

        // 渲染自定义背景
        backgroundList.createEl('h4', { text: '自定义背景', cls: 'background-custom-header' });
        this.plugin.settingsManager.getAllBackgrounds()
            .filter(background => !background.isPreset)
            .forEach(background => {
                const backgroundItem = backgroundList.createDiv('background-item');
                new Setting(backgroundItem)
                    .setName(background.name)
                    .addExtraButton(btn =>
                        btn.setIcon('pencil')
                            .setTooltip('编辑')
                            .onClick(() => {
                                // 使用背景编辑模态框
                                new CreateBackgroundModal(
                                    this.app,
                                    async (updatedBackground) => {
                                        await this.plugin.settingsManager.updateBackground(background.id, updatedBackground);
                                        this.display();
                                        new Notice('背景已更新');
                                    },
                                    background
                                ).open();
                            }))
                    .addExtraButton(btn =>
                        btn.setIcon('trash')
                            .setTooltip('删除')
                            .onClick(() => {
                                new ConfirmModal(
                                    this.app,
                                    '确认删除背景',
                                    `确定要删除「${background.name}」背景吗？此操作不可恢复。`,
                                    async () => {
                                        await this.plugin.settingsManager.removeBackground(background.id);
                                        this.display();
                                        new Notice('背景已删除');
                                    }
                                ).open();
                            }));
                
                // 添加背景预览
                const previewEl = backgroundItem.createDiv('background-preview');
                previewEl.setAttribute('style', background.style);
            });

        // 添加新背景按钮
        new Setting(containerEl)
            .addButton(btn => btn
                .setButtonText('+ 新建背景')
                .setCta()
                .onClick(() => {
                    // 使用新的背景创建模态框
                    new CreateBackgroundModal(
                        this.app,
                        async (newBackground) => {
                            await this.plugin.settingsManager.addCustomBackground(newBackground);
                            this.display();
                            new Notice('背景已创建');
                        }
                    ).open();
                }));
    }

    private renderWeChatSettings(containerEl: HTMLElement): void {
        const accounts = this.plugin.settingsManager.getWeChatAccounts();

        // 说明文字
        new Setting(containerEl)
            .setDesc('配置你的微信公众号账号，用于一键发布文章到公众号草稿箱。');

        // 账号列表
        if (accounts.length === 0) {
            new Setting(containerEl)
                .setName('暂无公众号账号')
                .setDesc('请点击下方按钮添加');
        } else {
            // 账号管理区域
            const accountList = containerEl.createDiv('wechat-account-management');

            accounts.forEach(account => {
                const accountItem = accountList.createDiv('wechat-account-item');

                // 构建描述文本
                let desc = `AppID: ${account.appId}`;
                if (account.isDefault) {
                    desc += ' | 🌟 默认账号';
                }

                new Setting(accountItem)
                    .setName(account.name)
                    .setDesc(desc)
                    .addExtraButton(btn => {
                        if (!account.isDefault) {
                            btn.setIcon('star')
                                .setTooltip('设为默认')
                                .onClick(async () => {
                                    await this.plugin.settingsManager.setDefaultWeChatAccount(account.id);
                                    this.display();
                                    new Notice('已设置默认公众号');
                                });
                        }
                    })
                    .addExtraButton(btn =>
                        btn.setIcon('pencil')
                            .setTooltip('编辑')
                            .onClick(() => {
                                new WeChatAccountModal(
                                    this.app,
                                    async (updatedAccount) => {
                                        await this.plugin.settingsManager.updateWeChatAccount(account.id, updatedAccount);
                                        this.display();
                                        new Notice('公众号账号已更新');
                                    },
                                    account
                                ).open();
                            }))
                    .addExtraButton(btn =>
                        btn.setIcon('trash')
                            .setTooltip('删除')
                            .onClick(() => {
                                new ConfirmModal(
                                    this.app,
                                    '确认删除',
                                    `确定要删除「${account.name}」吗？`,
                                    async () => {
                                        await this.plugin.settingsManager.removeWeChatAccount(account.id);
                                        this.display();
                                        new Notice('公众号账号已删除');
                                    }
                                ).open();
                            }));
            });
        }

        // 添加新账号按钮
        new Setting(containerEl)
            .addButton(btn => btn
                .setButtonText('+ 添加公众号账号')
                .setCta()
                .onClick(() => {
                    new WeChatAccountModal(
                        this.app,
                        async (newAccount) => {
                            await this.plugin.settingsManager.addWeChatAccount(newAccount);
                            this.display();
                            new Notice('公众号账号已添加');
                        }
                    ).open();
                }));
    }
}