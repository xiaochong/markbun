/* ==========================================
   MarkBun Website — Main JS
   Theme Toggle + i18n (EN / ZH)
   ========================================== */
const APP_VERSION = "v0.4.0";

// ==========================================
// Translations
// ==========================================
const T = {
  en: {
    // ---- Navigation ----
    nav_features:       "Features",
    nav_download:       "Download",
    nav_about:          "About",
    nav_github:         "GitHub",
    nav_cta:            "Download Free",

    // ---- Home — Hero ----
    home_badge:         `${APP_VERSION} Preview`,
    home_h1_a:          "The Free, Open-Source",
    home_h1_b:          "Markdown Editor",
    home_h1_c:          "You Deserve",
    home_tagline:       "Free & Open-Source, Write Without Limits",
    home_desc:          "MarkBun brings distraction-free WYSIWYG markdown editing to everyone — completely free, forever. Carved for focus, built for speed.",
    home_dl_btn:        "Download Free",
    home_gh_btn:        "View on GitHub",
    home_mockup_label:  "Untitled.md — MarkBun",

    // ---- Home — Features Grid ----
    home_feat_title:    "Precision Tools for Modern Writers",
    home_feat_sub:      "Everything you need, nothing you don't. Pure focus.",
    feat_c1_title:      "Free Forever",
    feat_c1_desc:       "No subscriptions, no \"pro\" tiers, no hidden costs. Open source and free for the community.",
    feat_c2_title:      "Blazing Fast",
    feat_c2_desc:       "Built with Bun and Vite for near-instant startup times and zero lag even in massive documents.",
    feat_c3_title:      "True WYSIWYG",
    feat_c3_desc:       "The editing experience is the preview experience. Seamlessly transition between modes.",
    feat_c4_title:      "Your Data is Safe",
    feat_c4_desc:       "Local-first architecture. We never touch your files or upload them to a cloud server.",
    feat_c5_title:      "Cross-Platform",
    feat_c5_desc:       "Running natively on macOS, Windows, and Linux with a consistent, premium experience.",
    feat_c6_title:      "Lightweight",
    feat_c6_desc:       "Minimal memory footprint. MarkBun is designed to stay out of your way while you work.",

    // ---- Home — Editor Showcase ----
    home_showcase_title: "Everything you expect from",
    home_showcase_accent: "top-tier editors.",
    home_showcase_f1_title: "WYSIWYG Editing",
    home_showcase_f1_desc:  "Real-time rendering of your markdown as you type.",
    home_showcase_f2_title: "Source Mode & Focus Mode",
    home_showcase_f2_desc:  "Switch to raw markdown or hide the UI for deep focus sessions.",
    home_showcase_f3_title: "Tables & KaTeX Support",
    home_showcase_f3_desc:  "First-class support for complex tables and mathematical notation.",
    home_showcase_f4_title: "Mermaid Diagrams",
    home_showcase_f4_desc:  "Visualize flows, charts, and diagrams directly in your docs.",

    // ---- Home — Open Source ----
    home_oss_title:     "Built in the open, for everyone.",
    home_oss_desc:      "MarkBun is licensed under MIT. We believe in transparency and community-driven development. No paywalls, no proprietary lock-ins.",
    home_oss_stars:     "GitHub Stars",
    home_oss_license:   "MIT Licensed",

    // ---- Home — Tech Stack ----
    home_tech_label:    "Powered by cutting-edge tech",

    // ---- Home — Download CTA ----
    home_cta_title:     "Ready to write without limits?",
    home_cta_desc:      `Join thousands of writers using MarkBun today. ${APP_VERSION} preview release.`,
    home_cta_version:   `Version ${APP_VERSION} • Open Source MIT`,

    // ---- Features Page ----
    feat_hero_badge:    "Professional Markdown Editor",
    feat_hero_title:    "Powerful features, zero cost",
    feat_hero_desc:     "Everything Typora has, and more — completely free. Built with precision for the modern technical writer.",

    feat_s1_title:      "1. Writing Experience",
    feat_s1_desc:       "Focus-driven interfaces that adapt to your mental model, whether you prefer visual editing or raw source control.",
    feat_s1_wysiwyg:    "WYSIWYG Mode (Milkdown)",
    feat_s1_wysiwyg_d:  "What you see is what you get. A seamless, fluid writing experience without the markdown syntax clutter.",
    feat_s1_src:        "Source Mode",
    feat_s1_src_d:      "Powered by CodeMirror 6 for high-performance syntax highlighting and keyboard shortcuts.",
    feat_s1_slash:      "Outline Navigation",
    feat_s1_slash_d:    "A live document outline in the sidebar parses your headings and lets you jump to any section instantly.",
    feat_s1_md:         "Standard Markdown",
    feat_s1_md_d:       "Full support for GFM (GitHub Flavored Markdown) and CommonMark for ultimate compatibility.",

    feat_s2_title:      "2. Rich Content",
    feat_s2_desc:       "Beyond simple text — express complex ideas with native integrations.",
    feat_s2_table:      "Advanced Tables",
    feat_s2_table_d:    "Visual table editor with drag-and-drop rows, columns, and instant formatting. No more manual pipe typing.",
    feat_s2_math:       "Math (KaTeX)",
    feat_s2_math_d:     "Fast and beautiful LaTeX math rendering for scientific documentation.",
    feat_s2_diag:       "Diagrams",
    feat_s2_diag_d:     "Full Mermaid.js support for charts and flows.",
    feat_s2_task:       "Task Lists",
    feat_s2_task_d:     "Interactive checkboxes that sync with your markdown.",

    feat_s3_title:      "3. Image Management",
    feat_s3_dd:         "Drag & Drop",
    feat_s3_dd_d:       "Drop images directly into the editor. MarkBun handles the rest.",
    feat_s3_copy:       "Auto-copy to assets/",
    feat_s3_copy_d:     "Keep your file structure clean. Images are automatically organized into your project folder.",
    feat_s3_fs:         "Full-screen viewer",
    feat_s3_fs_d:       "Click any image to inspect it in high resolution without leaving the app.",

    feat_s4_title:      "4. File Management",
    feat_s4_desc:       "Organize and navigate your markdown files efficiently.",
    feat_s4_explorer:   "Project Explorer",
    feat_s4_qo:         "Quick Open",

    feat_s5_title:      "5. Data Safety",
    feat_s5_desc:       "Your words are sacred. We provide 3 layers of ironclad protection.",
    feat_s5_badge:      "Three-Layer Protection",
    feat_s5_atomic:     "Atomic Write",
    feat_s5_atomic_d:   "Files are updated atomically to prevent corruption during unexpected power loss or disk errors.",
    feat_s5_crash:      "Crash Recovery",
    feat_s5_crash_d:    "The auto-save buffer ensures that even if the app crashes, your unsaved progress is always waiting for you.",
    feat_s5_hist:       "Version History",
    feat_s5_hist_d:     "Roll back to previous states of your document with integrated local snapshots and history tracking.",

    feat_s6_title:      "6. Customization",
    feat_s6_desc:       "Make MarkBun yours with extensive customization options.",
    feat_s6_typo:       "Typography Control",
    feat_s6_font:       "Font Size",
    feat_s6_lh:         "Line Height",
    feat_s6_theme:      "Interface Themes",
    feat_s6_dark:       "Dark",
    feat_s6_light:      "Light",
    feat_s6_system:     "System",
    feat_s6_sidebar:    "Sidebar width",

    feat_s7_title:      "7. Localization",
    feat_s7_desc:       "Write in your own tongue. MarkBun supports global languages with zero latency switching.",
    feat_s7_languages:  "Supported Languages",
    feat_s7_note:       "Instant language switching without app restart.",

    feat_cta_title:     "Ready to upgrade your workflow?",
    feat_cta_desc:      "Join thousands of developers and writers who switched to MarkBun.",
    feat_cta_dl:        "Download Free",
    feat_cta_changelog: "View Changelog",

    // ---- Download Page ----
    dl_badge:           "Preview Release",
    dl_title:           "Download MarkBun",
    dl_sub:             "Free for everyone. Always.",
    dl_version:         APP_VERSION,
    dl_latest:          "Preview Build",

    dl_mac:             "macOS",
    dl_mac_desc:        "Universal build supporting both Apple Silicon (M1/M2/M3) and Intel processors.",
    dl_mac_req1:        "Monterey 12.0+",
    dl_mac_req2:        ".dmg Installer",
    dl_mac_btn:         "Download .dmg",

    dl_win:             "Windows",
    dl_win_desc:        "Optimized for Windows 10 and 11. Available as an installer or portable zip.",
    dl_win_req1:        "Windows 10/11",
    dl_win_req2:        ".exe / .zip",
    dl_win_btn:         "Download .exe",

    dl_linux:           "Linux",
    dl_linux_desc:      "Support for major distributions with standalone and package-based binaries.",
    dl_linux_req1:      "x64 Architecture",
    dl_linux_req2:      ".AppImage / .deb",
    dl_linux_btn:       "Download AppImage",

    dl_install_title:   "Installation Guide",
    dl_step1_title:     "Download the file",
    dl_step1_desc:      "Choose the correct version for your operating system above and wait for the download to complete.",
    dl_step2_title:     "Run the Installer",
    dl_step2_desc:      "On macOS, drag MarkBun to your Applications folder. On Windows, double-click the .exe file.",
    dl_step3_title:     "Security Permissions",
    dl_step3_desc:      "On macOS, if you see a \"damaged\" warning, run the command below in Terminal. On Windows, click \"More info\" → \"Run anyway\".",

    dl_src_title:       "Build from Source",
    dl_src_desc:        "Want to customize MarkBun? Build it directly using Bun runtime.",
    dl_notes_title:     "Release Notes",
    dl_notes_sub:       `See what's new in ${APP_VERSION}`,
    dl_notes_link:      "Full Changelog",

    dl_faq_title:       "Frequently Asked Questions",
    dl_faq1_q:          "Is MarkBun really free?",
    dl_faq1_a:          "Yes. MarkBun is an open-source project and will always be free to download and use. No subscriptions, no hidden fees.",
    dl_faq2_q:          "Is it safe to download?",
    dl_faq2_a:          "Absolutely. All binaries are built directly from the public GitHub repository. We use automated CI/CD pipelines to ensure integrity and security.",
    dl_faq3_q:          "Current Version Status?",
    dl_faq3_a:          "Preview release. MacOS is fully supported. Windows builds are experimental and may have issues. Linux builds are not yet tested.",
    dl_faq4_q:          "macOS says \"MarkBun is damaged\"",
    dl_faq4_a:          "MarkBun is not yet code-signed, so macOS Gatekeeper blocks it. Open Terminal and run: xattr -cr /Applications/MarkBun.app — then launch the app again.",

    dl_community_title: "Stay in the loop",
    dl_community_desc:  "Join our developer community to get notified about new features, security patches, and performance boosts.",
    dl_community_ph:    "email@example.com",
    dl_community_btn:   "Subscribe",

    // ---- About Page ----
    about_badge:        "Open Source Philosophy",
    about_title_a:      "Engineered for",
    about_title_b:      "Pure Expression.",
    about_desc:         "MarkBun was born from a simple frustration: powerful writing tools shouldn't be locked behind subscriptions or proprietary formats. We built a precision instrument for the modern age.",

    about_origin_title: "Project Origins",
    about_origin_p1:    "MarkBun = Mark(down) + (Electro)bun.",
    about_origin_p2:    "Inspired by the seamless editing experience of Typora but committed to the ethos of open-source freedom. We wanted an editor that felt as fast as a terminal but as elegant as a high-end publication.",
    about_origin_p3:    "By leveraging Bun and Native WebView, we bypassed the bloat of traditional Electron apps, resulting in an editor that launches instantly and respects your system's resources.",

    about_speed_title:  "The Speed Mandate",
    about_speed_desc:   "Built on Bun, the JavaScript runtime designed for speed. Zero-lag Markdown rendering even in 100k+ word documents.",
    about_live_title:   "Live Preview",
    about_live_desc:    "A distraction-free interface that blends the source code and visual output into a single, cohesive canvas.",

    about_values_title: "Our Core Values",
    about_values_desc:  "The pillars that define every line of code we write.",
    about_v1_title:     "Local-First",
    about_v1_desc:      "Your data belongs to you. No cloud required, no proprietary syncing engines, just your files on your hard drive.",
    about_v1_tag:       "No proprietary lock-in",
    about_v2_title:     "No Telemetry",
    about_v2_desc:      "We don't track your keystrokes, your document titles, or your usage patterns. MarkBun is a silent partner in your work.",
    about_v2_tag:       "Privacy by design",
    about_v3_title:     "Transparency",
    about_v3_desc:      "The development process is fully transparent on GitHub. Anyone can inspect, audit, or contribute to the source code.",
    about_v3_tag:       "Community driven",

    about_arch_title:   "Technical Architecture",
    about_arch_desc:    "MarkBun utilizes a dual-process architecture to ensure maximum performance and security. By decoupling the main logic from the rendering layer, we achieve a level of responsiveness that Electron-based editors struggle to match.",
    about_arch_main:    "Main Process (Bun)",
    about_arch_main_d:  "Handles file I/O, OS integration, and window management with the extreme performance of the Zig-based Bun runtime.",
    about_arch_render:  "Renderer (WebView + React/Milkdown)",
    about_arch_render_d:"A lightweight native WebView instance hosting a React-powered UI and the Milkdown framework for WYSIWYG editing.",

    about_lic_title:    "MIT License",
    about_lic_desc:     "MarkBun is released under the MIT License. You are free to use, modify, and distribute the software for both personal and commercial projects. Freedom is not just a feature; it's our foundation.",
    about_lic_link:     "Read the License terms",
    about_contrib_title:"Contributing",
    about_contrib_desc: "We welcome contributions of all kinds. Whether you are fixing bugs, proposing new features, or improving documentation, your help makes MarkBun better for everyone.",
    about_contrib_link: "GitHub Contribution Guide",

    about_contact_title:"Need help or want to discuss?",
    about_contact_desc: "Our community is built around transparency. For support, feature requests, or just to say hi, join us on our GitHub discussion board.",
    about_disc_btn:     "GitHub Discussions",
    about_issue_btn:    "Report an Issue",

    // ---- Footer ----
    footer_tagline:     "The precision instrument for markdown writing. Built for the future.",
    footer_product:     "Product",
    footer_resources:   "Resources",
    footer_community:   "Community",
    footer_features:    "Features",
    footer_download:    "Download",
    footer_changelog:   "Changelog",
    footer_about:       "About",
    footer_github:      "GitHub",
    footer_license:     "License",
    footer_issues:      "GitHub Issues",
    footer_twitter:     "Twitter",
    footer_discussions: "Discussions",
    footer_copy:        "Made with ♥ using Bun + React. © 2026 MarkBun. Open source under MIT License.",
  },

  // ==========================================
  zh: {
    nav_features:       "功能",
    nav_download:       "下载",
    nav_about:          "关于",
    nav_github:         "GitHub",
    nav_cta:            "免费下载",

    home_badge:         `${APP_VERSION} 预览版`,
    home_h1_a:          "免费开源的",
    home_h1_b:          "Markdown 编辑器",
    home_h1_c:          "你值得拥有",
    home_tagline:       "免费开源，写作无界",
    home_desc:          "MarkBun 为每位用户带来无干扰的 WYSIWYG Markdown 编辑体验——完全免费，永不收费。专为专注而生，为速度而建。",
    home_dl_btn:        "免费下载",
    home_gh_btn:        "在 GitHub 上查看",
    home_mockup_label:  "Untitled.md — MarkBun",

    home_feat_title:    "现代写作者的精准工具",
    home_feat_sub:      "你需要的一切，仅此而已。纯粹专注。",
    feat_c1_title:      "永久免费",
    feat_c1_desc:       "无订阅费、无「专业版」分级、无隐藏成本。开源免费，回馈社区。",
    feat_c2_title:      "极速启动",
    feat_c2_desc:       "基于 Bun 和 Vite 构建，实现近乎即时的启动速度，即使处理超大文档也毫无卡顿。",
    feat_c3_title:      "真正所见即所得",
    feat_c3_desc:       "编辑体验即预览体验。在不同模式之间无缝切换。",
    feat_c4_title:      "数据安全无忧",
    feat_c4_desc:       "本地优先架构。我们绝不触碰您的文件，也不会上传到任何云服务器。",
    feat_c5_title:      "跨平台支持",
    feat_c5_desc:       "在 macOS、Windows 和 Linux 上原生运行，提供一致的高品质体验。",
    feat_c6_title:      "轻量级",
    feat_c6_desc:       "极小的内存占用。MarkBun 专为不打扰您工作而设计。",

    home_showcase_title: "顶级编辑器的一切，",
    home_showcase_accent: "你都能拥有。",
    home_showcase_f1_title: "WYSIWYG 编辑",
    home_showcase_f1_desc:  "输入时实时渲染 Markdown。",
    home_showcase_f2_title: "源码模式与专注模式",
    home_showcase_f2_desc:  "切换到原始 Markdown 或隐藏 UI 进行深度专注写作。",
    home_showcase_f3_title: "表格与 KaTeX 支持",
    home_showcase_f3_desc:  "一流的复杂表格和数学公式支持。",
    home_showcase_f4_title: "Mermaid 图表",
    home_showcase_f4_desc:  "直接在文档中可视化流程图、图表。",

    home_oss_title:     "开放构建，人人共享。",
    home_oss_desc:      "MarkBun 采用 MIT 许可证。我们相信透明度和社区驱动的开发。无付费墙，无专有锁定。",
    home_oss_stars:     "GitHub Stars",
    home_oss_license:   "MIT 许可证",

    home_tech_label:    "尖端技术驱动",

    home_cta_title:     "准备好无拘无束地写作了吗？",
    home_cta_desc:      `立即加入数千名使用 MarkBun 的写作者。${APP_VERSION} 预览版。`,
    home_cta_version:   `版本 ${APP_VERSION} • MIT 开源协议`,

    feat_hero_badge:    "专业 Markdown 编辑器",
    feat_hero_title:    "强大功能，零成本",
    feat_hero_desc:     "Typora 有的功能，我们都有，更多——且完全免费。为现代技术写作者精心打造。",

    feat_s1_title:      "1. 写作体验",
    feat_s1_desc:       "以专注为核心的界面，无论您偏爱可视化编辑还是原始源码控制，都能适应您的思维模式。",
    feat_s1_wysiwyg:    "WYSIWYG 模式（Milkdown）",
    feat_s1_wysiwyg_d:  "所见即所得。无缝流畅的写作体验，无 Markdown 语法干扰。",
    feat_s1_src:        "源码模式",
    feat_s1_src_d:      "由 CodeMirror 6 驱动，提供高性能语法高亮和键盘快捷键。",
    feat_s1_slash:      "大纲导航",
    feat_s1_slash_d:    "侧边栏实时解析文档标题层级，点击任意条目即可跳转到对应章节。",
    feat_s1_md:         "标准 Markdown",
    feat_s1_md_d:       "完整支持 GFM（GitHub Flavored Markdown）和 CommonMark 规范，实现最高兼容性。",

    feat_s2_title:      "2. 富内容",
    feat_s2_desc:       "超越纯文本——用原生集成表达复杂想法。",
    feat_s2_table:      "高级表格",
    feat_s2_table_d:    "可视化表格编辑器，支持拖拽行列和即时格式化。无需手动输入竖线符号。",
    feat_s2_math:       "数学公式（KaTeX）",
    feat_s2_math_d:     "快速、美观的 LaTeX 数学公式渲染，适用于科学文档。",
    feat_s2_diag:       "流程图",
    feat_s2_diag_d:     "完整支持 Mermaid.js 图表和流程图。",
    feat_s2_task:       "任务列表",
    feat_s2_task_d:     "与 Markdown 同步的交互式复选框。",

    feat_s3_title:      "3. 图片管理",
    feat_s3_dd:         "拖拽插入",
    feat_s3_dd_d:       "直接将图片拖入编辑器，MarkBun 自动处理其余事项。",
    feat_s3_copy:       "自动复制到 assets/",
    feat_s3_copy_d:     "保持文件结构整洁。图片自动整理到项目文件夹中。",
    feat_s3_fs:         "全屏查看",
    feat_s3_fs_d:       "点击任意图片以高分辨率查看，无需离开应用。",

    feat_s4_title:      "4. 文件管理",
    feat_s4_desc:       "高效地组织和导航您的 Markdown 文件。",
    feat_s4_explorer:   "项目资源管理器",
    feat_s4_qo:         "快速打开",

    feat_s5_title:      "5. 数据安全",
    feat_s5_desc:       "您的文字至关重要。我们提供三层坚不可摧的保护。",
    feat_s5_badge:      "三层保护机制",
    feat_s5_atomic:     "原子写入",
    feat_s5_atomic_d:   "文件以原子方式更新，防止意外断电或磁盘错误导致的文件损坏。",
    feat_s5_crash:      "崩溃恢复",
    feat_s5_crash_d:    "自动保存缓冲区确保即使应用崩溃，您未保存的内容也始终等待您恢复。",
    feat_s5_hist:       "版本历史",
    feat_s5_hist_d:     "通过集成的本地快照和历史追踪，回滚到文档的任意历史状态。",

    feat_s6_title:      "6. 个性化定制",
    feat_s6_desc:       "通过丰富的自定义选项，打造属于您的 MarkBun。",
    feat_s6_typo:       "字体排版控制",
    feat_s6_font:       "字号",
    feat_s6_lh:         "行高",
    feat_s6_theme:      "界面主题",
    feat_s6_dark:       "暗色",
    feat_s6_light:      "亮色",
    feat_s6_system:     "跟随系统",
    feat_s6_sidebar:    "侧栏宽度",

    feat_s7_title:      "7. 本地化支持",
    feat_s7_desc:       "用你的母语写作。MarkBun 支持多种全球语言，切换零延迟。",
    feat_s7_languages:  "支持的语言",
    feat_s7_note:       "无需重启应用即可即时切换语言。",

    feat_cta_title:     "准备升级您的写作工作流了吗？",
    feat_cta_desc:      "加入已切换到 MarkBun 的数千名开发者和写作者。",
    feat_cta_dl:        "免费下载",
    feat_cta_changelog: "查看更新日志",

    dl_badge:           "预览版本",
    dl_title:           "下载 MarkBun",
    dl_sub:             "永久免费，人人皆可使用。",
    dl_version:         APP_VERSION,
    dl_latest:          "预览构建",

    dl_mac:             "macOS",
    dl_mac_desc:        "通用构建，支持 Apple Silicon（M1/M2/M3）和 Intel 处理器。",
    dl_mac_req1:        "Monterey 12.0+",
    dl_mac_req2:        ".dmg 安装包",
    dl_mac_btn:         "下载 .dmg",

    dl_win:             "Windows",
    dl_win_desc:        "针对 Windows 10 和 11 优化，提供安装程序和便携 zip 两种版本。",
    dl_win_req1:        "Windows 10/11",
    dl_win_req2:        ".exe / .zip",
    dl_win_btn:         "下载 .exe",

    dl_linux:           "Linux",
    dl_linux_desc:      "支持主流发行版，提供独立二进制文件和包管理器安装。",
    dl_linux_req1:      "x64 架构",
    dl_linux_req2:      ".AppImage / .deb",
    dl_linux_btn:       "下载 AppImage",

    dl_install_title:   "安装指南",
    dl_step1_title:     "下载文件",
    dl_step1_desc:      "在上方选择适合您操作系统的版本，等待下载完成。",
    dl_step2_title:     "运行安装程序",
    dl_step2_desc:      "在 macOS 上，将 MarkBun 拖入「应用程序」文件夹；在 Windows 上，双击 .exe 文件。",
    dl_step3_title:     "安全权限",
    dl_step3_desc:      "在 macOS 上，如果提示「已损坏」，请在终端执行下方命令。在 Windows 上，点击「更多信息」→「仍要运行」。",

    dl_src_title:       "从源码构建",
    dl_src_desc:        "想要自定义 MarkBun？使用 Bun 运行时直接构建。",
    dl_notes_title:     "发布说明",
    dl_notes_sub:       `查看 ${APP_VERSION} 的新内容`,
    dl_notes_link:      "完整更新日志",

    dl_faq_title:       "常见问题",
    dl_faq1_q:          "MarkBun 真的完全免费吗？",
    dl_faq1_a:          "是的。MarkBun 是一个开源项目，将永远免费提供下载和使用。无订阅费，无隐藏收费。",
    dl_faq2_q:          "下载安全吗？",
    dl_faq2_a:          "完全安全。所有二进制文件直接从公开的 GitHub 仓库构建，使用自动化 CI/CD 流程确保完整性和安全性。",
    dl_faq3_q:          "当前版本状态？",
    dl_faq3_a:          "预览版。MacOS 完全可用，Windows 版本可能存在问题，Linux 版本尚未测试。",
    dl_faq4_q:          "macOS 提示「MarkBun 已损坏」",
    dl_faq4_a:          "MarkBun 尚未进行代码签名，macOS Gatekeeper 会阻止运行。打开终端执行：xattr -cr /Applications/MarkBun.app，然后重新启动应用即可。",

    dl_community_title: "关注最新动态",
    dl_community_desc:  "加入我们的开发者社区，获取新功能、安全补丁和性能提升的通知。",
    dl_community_ph:    "邮箱@example.com",
    dl_community_btn:   "订阅",

    about_badge:        "开源哲学",
    about_title_a:      "为纯粹的",
    about_title_b:      "表达而生",
    about_desc:         "MarkBun 诞生于一个简单的痛点：强大的写作工具不应被订阅费和专有格式所束缚。我们打造了一款为现代时代量身定制的精准工具。",

    about_origin_title: "项目起源",
    about_origin_p1:    "MarkBun = Mark(down)（Markdown）+ (Electro)bun（Bun 运行时）。",
    about_origin_p2:    "受 Typora 无缝编辑体验的启发，同时坚守开源自由的理念。我们希望打造一款像终端一样快、像高端出版物一样优雅的编辑器。",
    about_origin_p3:    "借助 Bun 和原生 WebView，我们绕过了传统 Electron 应用的臃肿，打造出即时启动、尊重系统资源的编辑器。",

    about_speed_title:  "速度使命",
    about_speed_desc:   "基于为速度而生的 JavaScript 运行时 Bun 构建。即使是 10 万字以上的文档，Markdown 渲染也零延迟。",
    about_live_title:   "实时预览",
    about_live_desc:    "无干扰的界面将源码与视觉输出融合为单一、统一的画布。",

    about_values_title: "我们的核心价值观",
    about_values_desc:  "定义我们每一行代码的基石。",
    about_v1_title:     "本地优先",
    about_v1_desc:      "您的数据属于您自己。无需云端，无专有同步引擎，只是您的文件存储在您的硬盘上。",
    about_v1_tag:       "无专有锁定",
    about_v2_title:     "零遥测",
    about_v2_desc:      "我们不追踪您的按键记录、文档标题或使用习惯。MarkBun 是您工作中沉默的伙伴。",
    about_v2_tag:       "隐私设计",
    about_v3_title:     "透明度",
    about_v3_desc:      "开发过程在 GitHub 上完全透明。任何人都可以审查、审计或贡献源代码。",
    about_v3_tag:       "社区驱动",

    about_arch_title:   "技术架构",
    about_arch_desc:    "MarkBun 采用双进程架构，确保最高性能和安全性。通过将核心逻辑与渲染层解耦，实现了基于 Electron 的编辑器难以匹敌的响应速度。",
    about_arch_main:    "主进程（Bun）",
    about_arch_main_d:  "使用基于 Zig 的 Bun 运行时的极致性能，处理文件 I/O、系统集成和窗口管理。",
    about_arch_render:  "渲染进程（WebView + React/Milkdown）",
    about_arch_render_d:"轻量级原生 WebView 实例，托管 React 驱动的 UI 和用于 WYSIWYG 编辑的 Milkdown 框架。",

    about_lic_title:    "MIT 许可证",
    about_lic_desc:     "MarkBun 在 MIT 许可证下发布。您可以自由地将该软件用于个人和商业项目，进行使用、修改和分发。自由不仅仅是一项功能，它是我们的根基。",
    about_lic_link:     "查看许可证条款",
    about_contrib_title:"贡献",
    about_contrib_desc: "我们欢迎各种形式的贡献。无论是修复 Bug、提出新功能，还是改善文档，您的帮助都让 MarkBun 对每个人更好。",
    about_contrib_link: "GitHub 贡献指南",

    about_contact_title:"需要帮助或想讨论？",
    about_contact_desc: "我们的社区以透明度为基础。如需支持、功能请求或只是打个招呼，欢迎加入我们的 GitHub 讨论板。",
    about_disc_btn:     "GitHub 讨论",
    about_issue_btn:    "报告问题",

    footer_tagline:     "Markdown 写作的精准工具，为未来而建。",
    footer_product:     "产品",
    footer_resources:   "资源",
    footer_community:   "社区",
    footer_features:    "功能",
    footer_download:    "下载",
    footer_changelog:   "更新日志",
    footer_about:       "关于",
    footer_github:      "GitHub",
    footer_license:     "许可证",
    footer_issues:      "GitHub Issues",
    footer_twitter:     "Twitter",
    footer_discussions: "讨论",
    footer_copy:        "用 ♥ 以 Bun + React 构建。© 2026 MarkBun。MIT 开源协议。",
  }
};

// ==========================================
// Current state
// ==========================================
let currentLang  = localStorage.getItem("mb-lang")  || "en";
let currentTheme = localStorage.getItem("mb-theme") || "light";

// ==========================================
// Theme
// ==========================================
function applyTheme(theme) {
  currentTheme = theme;
  localStorage.setItem("mb-theme", theme);
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
  // Update toggle button icons
  const btnDark  = document.getElementById("theme-btn-dark");
  const btnLight = document.getElementById("theme-btn-light");
  if (btnDark && btnLight) {
    btnDark.classList.toggle("hidden",  theme === "dark");
    btnLight.classList.toggle("hidden", theme === "light");
  }
}

function toggleTheme() {
  applyTheme(currentTheme === "dark" ? "light" : "dark");
}

// ==========================================
// Language / i18n
// ==========================================
function applyLang(lang) {
  currentLang = lang;
  localStorage.setItem("mb-lang", lang);
  const dict = T[lang];
  if (!dict) return;

  // text content
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (dict[key] !== undefined) el.textContent = dict[key];
  });
  // html content
  document.querySelectorAll("[data-i18n-html]").forEach(el => {
    const key = el.getAttribute("data-i18n-html");
    if (dict[key] !== undefined) el.innerHTML = dict[key];
  });
  // placeholder
  document.querySelectorAll("[data-i18n-ph]").forEach(el => {
    const key = el.getAttribute("data-i18n-ph");
    if (dict[key] !== undefined) el.placeholder = dict[key];
  });
  // update all lang toggle button labels
  document.querySelectorAll("#lang-btn, .lang-btn-text").forEach(el => {
    el.textContent = lang === "en" ? "中文" : "EN";
  });

  // update <html lang>
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
}

function toggleLang() {
  applyLang(currentLang === "en" ? "zh" : "en");
}

// ==========================================
// Init on DOM ready
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  applyTheme(currentTheme);
  applyLang(currentLang);

  // Wire up theme toggles (one or more on page)
  document.querySelectorAll("#theme-toggle, .theme-toggle-btn").forEach(btn => {
    btn.addEventListener("click", toggleTheme);
  });

  // Wire up lang toggles (desktop + mobile variants)
  document.querySelectorAll("#lang-toggle, #lang-toggle-m, .lang-toggle-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      toggleLang();
      // update this button's text too if it has lang-btn children
      const lb = btn.querySelector(".lang-btn-text");
      if (lb) lb.textContent = currentLang === "en" ? "中文" : "EN";
    });
  });

  // Mobile menu toggle
  const mobileBtn  = document.getElementById("mobile-menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");
  if (mobileBtn && mobileMenu) {
    mobileBtn.addEventListener("click", () => {
      mobileMenu.classList.toggle("hidden");
    });
  }
});
