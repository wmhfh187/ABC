# 协作规范

本文约定分支、提交、代码风格与 Godot 特有问题的处理方式。开始写代码前请通读一遍。

## 1. 分支模型

| 分支 | 用途 | 规则 |
| --- | --- | --- |
| `main` | 可运行的稳定版本 / 可发布版本 | 只接受 PR 合并，禁止直接 push、禁止 force push |
| `dev` | 日常集成分支 | 功能分支合并到这里，定期联调 |
| `feat/<功能>` | 新功能，从 `dev` 切出 | 例：`feat/inventory-drag` |
| `fix/<问题>` | 修 bug，从 `dev` 切出 | 例：`fix/save-lost` |
| `art/<内容>` | 纯美术资源导入 | 例：`art/ui-icons` |

**发版**：`dev` 联调通过后提 PR 合到 `main`，并打 tag（如 `v0.1.0`）。

日常操作：

```bash
git switch dev
git pull
git switch -c feat/xxx
# 开发、提交...
git push -u origin feat/xxx
# 到 GitHub 上向 dev 提 Pull Request
```

## 2. 提交信息

格式：`<类型>: <一句话说明>`

| 类型 | 含义 |
| --- | --- |
| `feat` | 新功能 |
| `fix` | 修 bug |
| `refactor` | 重构，行为不变 |
| `art` | 美术资源 |
| `docs` | 文档 |
| `chore` | 杂项：配置、依赖、版本 |
| `test` | 测试 |

示例：`feat: 背包格子支持拖拽交换`、`fix: 退出战斗后 BGM 不停止`。

一次提交只做一件事，避免把格式化改动和功能改动混在一起。

## 3. Pull Request

- PR 标题同提交信息格式，描述里写**改了什么、为什么改、怎么验证的**。
- 至少一名协作者 review 后再合并（仓库设置允许时可自行合并小改动）。
- 合并前先把 `dev` 的最新改动合进来，解决冲突后再合。
- 大功能拆小 PR，单个 PR 别超过几百行改动。

## 4. 代码规范（GDScript）

- 命名：文件/变量/函数用 `snake_case`，类与节点名用 `PascalCase`，常量用 `UPPER_SNAKE_CASE`。
- 类型标注：能标注就标注（`var hp: int = 10`、`func take_damage(amount: int) -> void`）。
- 缩进用 Tab（Godot 默认），编码 UTF-8，换行 LF（`.gitattributes` 已强制）。
- 跨系统通信优先走 `EventBus` 的信号，避免到处 `get_node("../../..")`。
- 全局状态只放 `GameManager`，存档只经过 `SaveSystem`。
- 可复用能力抽成 `class_name` 脚本或组件场景，而不是复制粘贴。
- 新增 Autoload 必须在 `project.godot` 的 `[autoload]` 注册，并更新 README 的单例表格。

## 5. Godot 特有注意事项

1. **不要提交 `.godot/`**（导入缓存，体积大且与机器相关）。仓库根级 `.gitignore` 已排除。
2. **要提交**：`project.godot`、`*.import`、`*.tscn`、`*.tres`、`*.gd`、`*.svg`、导出预设 `export_presets.cfg`。
3. **同一场景同一时间只允许一个人改**。`.tscn`/`.tres` 冲突几乎无法手工合并，硬合会产生坏场景。
   需要多人同时做同一个界面时，拆成多个子场景（`ui/` 下按功能拆分）再实例化组合。
4. **Godot 版本必须一致**（当前 4.7）。升级版本要单独提一个 PR，全员同步后其他人再更新本地编辑器。
5. **美术资源**：贴图/音频/模型按 `assets/textures|audio|fonts` 分类放置，文件名用小写英文加下划线，不要用中文或空格。
6. 提交前在编辑器里跑一遍改动涉及的场景，确认控制台没有新的红色报错。

## 6. 资源变大后的处理

当仓库里开始出现大量贴图、音频、模型（单个仓库接近 100 MB）时，改用 Git LFS：

```bash
git lfs install
git lfs track "*.png" "*.jpg" "*.wav" "*.ogg" "*.glb" "*.fbx"
git add .gitattributes
```

## 7. 环境准备清单（新协作者）

1. 安装 Godot 4.7。
2. 配置 Git 身份：`git config --global user.name "你的名字"`、`git config --global user.email "你的邮箱"`。
3. 建议：`git config --global pull.rebase true`、`git config --global core.autocrlf false`（换行由 `.gitattributes` 统一）。
4. 克隆仓库，用 Godot 打开 `新建游戏项目/project.godot`，等待首次导入完成。
5. 读一遍本文和 README，然后从 `dev` 切自己的功能分支开工。
