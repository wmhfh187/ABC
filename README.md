# ABC

基于 **Godot 4.7（Mobile 渲染器 + Jolt 物理）** 的移动端游戏项目。

## 环境要求

| 项目 | 版本 / 说明 |
| --- | --- |
| Godot | **4.7**（团队必须统一版本，否则 `project.godot` 会被反复改写并产生冲突） |
| 渲染器 | Mobile（`renderer/rendering_method="mobile"`） |
| 物理引擎 | Jolt Physics |
| 版本控制 | Git；GitHub 仓库 `wmhfh187/ABC` |

## 目录结构

```
.
├── README.md
├── CONTRIBUTING.md          # 协作规范（必读）
├── .gitignore / .gitattributes
└── 新建游戏项目/             # Godot 工程根目录（用编辑器打开这里）
    ├── project.godot        # 工程配置，含 Autoload 注册
    ├── icon.svg
    ├── scenes/              # 场景（.tscn）
    ├── ui/                  # 界面场景与控件脚本
    ├── scripts/
    │   └── autoload/        # 全局单例脚本
    └── assets/              # 美术资源
        ├── textures/
        ├── audio/
        └── fonts/
```

## 全局单例（Autoload）

| 名称 | 文件 | 职责 |
| --- | --- | --- |
| `GameManager` | `scripts/autoload/game_manager.gd` | 游戏状态、暂停、开始/结束流程 |
| `EventBus` | `scripts/autoload/event_bus.gd` | 跨系统信号解耦 |
| `SaveSystem` | `scripts/autoload/save_system.gd` | JSON 存档读写与版本校验 |

新增全局单例时，在编辑器的「项目 → 项目设置 → 自动加载」里注册，或直接改 `project.godot` 的 `[autoload]` 段，并同步更新本表。

## 本地运行

1. 安装 Godot **4.7**（标准版即可，本项目未使用 C#）。
2. 打开 Godot → 导入 → 选择 `新建游戏项目/project.godot`。
3. 首次导入会自动生成 `.godot/` 缓存（已被忽略，**不要提交**）。
4. 按 F5 运行（主场景尚未创建，创建后在「项目设置 → 运行 → 主场景」指定）。

## 协作

分支模型、提交规范、场景冲突处理见 **[CONTRIBUTING.md](CONTRIBUTING.md)**。一句话版本：`main` 只放可运行版本，`dev` 做日常集成，功能开 `feat/*` 分支提 PR。

## 存档位置

`user://save.json`，Windows 下为 `%APPDATA%\Godot\app_userdata\<项目名>\save.json`。
