extends Node
## JSON 存档系统（Autoload 名称：SaveSystem）
##
## 只负责“读写文件 + 版本校验”，存什么由调用方决定：
##   SaveSystem.save_game({"player": {"hp": 100}})
##   var data := SaveSystem.load_game()
##
## 增加字段时请同时提升 SAVE_VERSION，并在 load_game 里做迁移，
## 否则老存档在新版本里会读不出来。

const SAVE_PATH := "user://save.json"
const SAVE_VERSION := 1

signal saved()
signal loaded()


## 写入存档，成功返回 true。
func save_game(data: Dictionary) -> bool:
	var payload := data.duplicate(true)
	payload["version"] = SAVE_VERSION
	payload["saved_at"] = Time.get_datetime_string_from_system(true)

	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null:
		push_error("SaveSystem: 无法写入存档 %s（错误码 %d）" % [SAVE_PATH, FileAccess.get_open_error()])
		return false

	file.store_string(JSON.stringify(payload, "\t"))
	file.close()
	saved.emit()
	return true


## 读取存档；没有存档或文件损坏时返回空字典。
func load_game() -> Dictionary:
	if not FileAccess.file_exists(SAVE_PATH):
		return {}

	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if file == null:
		push_error("SaveSystem: 无法读取存档 %s（错误码 %d）" % [SAVE_PATH, FileAccess.get_open_error()])
		return {}

	var text := file.get_as_text()
	file.close()

	var parsed: Variant = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		push_warning("SaveSystem: 存档格式损坏，已忽略")
		return {}

	var data: Dictionary = parsed
	var version := int(data.get("version", 0))
	if version != SAVE_VERSION:
		push_warning("SaveSystem: 存档版本 %d 与当前版本 %d 不一致" % [version, SAVE_VERSION])

	loaded.emit()
	return data


func has_save() -> bool:
	return FileAccess.file_exists(SAVE_PATH)


func delete_save() -> void:
	if has_save():
		DirAccess.remove_absolute(SAVE_PATH)
