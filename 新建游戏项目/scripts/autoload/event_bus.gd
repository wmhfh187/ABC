extends Node
## 全局事件总线（Autoload 名称：EventBus）
##
## 用于解耦系统间通信：发信号的不知道谁在听，监听方也不需要持有发送方的引用。
## 约定：新增信号统一写在这里，并补一行注释说明“什么时候发”。
## 用法：
##   EventBus.player_health_changed.emit(hp, max_hp)
##   EventBus.player_health_changed.connect(_on_health_changed)


# --- 游戏流程 ---

## 新游戏开始（读档成功或全新开局）时发出。
signal game_started()

## 一局结束（胜利/失败/退出）时发出。
signal game_over(won: bool)

## 成功切换场景后发出，参数为新场景路径。
signal scene_changed(scene_path: String)


# --- 玩家 / 战斗 ---

## 玩家生命值变化时发出。
signal player_health_changed(current: int, maximum: int)

## 玩家死亡时发出。
signal player_died()


# --- 存档 ---

## 存档写入成功后发出。
signal game_saved()

## 读档成功后发出。
signal game_loaded()
