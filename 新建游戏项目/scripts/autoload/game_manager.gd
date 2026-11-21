extends Node
## 全局游戏状态管理（Autoload 名称：GameManager）
##
## 只放与具体关卡无关的全局流程：游戏状态、暂停、开始/结束游戏。
## 关卡内的玩法逻辑写在各自场景的脚本里，不要堆到这个单例上。

enum State { BOOT, MENU, PLAYING, PAUSED, GAME_OVER }

signal state_changed(new_state: State)
signal game_paused(is_paused: bool)

var _state: State = State.BOOT

## 当前游戏状态。赋值时会发出 state_changed，并忽略重复赋值。
var state: State:
	get:
		return _state
	set(value):
		if _state == value:
			return
		_state = value
		state_changed.emit(_state)


func is_playing() -> bool:
	return _state == State.PLAYING


func start_game() -> void:
	get_tree().paused = false
	state = State.PLAYING
	EventBus.game_started.emit()


## 暂停/恢复。状态没有实际变化时直接返回，避免监听方收到重复信号。
func pause_game(paused: bool = true) -> void:
	if _state != State.PLAYING and _state != State.PAUSED:
		return

	var target: State = State.PAUSED if paused else State.PLAYING
	if _state == target:
		return

	get_tree().paused = paused
	state = target
	game_paused.emit(paused)


## 结束本局并广播结果，供 UI/统计系统监听 EventBus.game_over。
func end_game(won: bool = false) -> void:
	if _state == State.GAME_OVER:
		return

	get_tree().paused = false
	state = State.GAME_OVER
	EventBus.game_over.emit(won)
