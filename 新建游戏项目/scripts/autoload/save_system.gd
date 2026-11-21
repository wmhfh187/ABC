extends Node
## JSON 存档系统（Autoload 名称：SaveSystem）
##
## 只负责“读写文件 + 版本校验”，存什么由调用方决定：
##   SaveSystem.save_game({"player": {"hp": 100}})
##   var data := SaveSystem.load_game()
##
## 增加字段时请同时提升 SAVE_VERSION，并在 load_game 里补上对应的迁移分支；
## 没有迁移分支的版本会被直接丢弃（返回空字典），避免调用方读到结构不对的数据。

const SAVE_PATH := "user://save.json"
const SAVE_TMP_PATH := SAVE_PATH + ".tmp"
const SAVE_VERSION := 1

signal saved()
signal loaded()


## 写入存档，成功返回 true。
func save_game(data: Dictionary) -> bool:
	var payload := data.duplicate(true)
	payload["version"] = SAVE_VERSION
	payload["saved_at"] = Time.get_datetime_string_from_system(true)

	# 先写临时文件再原子替换：写到一半崩溃时旧存档仍然完整，不会留下半截 JSON
	var file := FileAccess.open(SAVE_TMP_PATH, FileAccess.WRITE)
	if file == null:
		push_error("SaveSystem: 无法写入存档 %s（错误码 %d）" % [SAVE_TMP_PATH, FileAccess.get_open_error()])
		return false

	file.store_string(JSON.stringify(payload, "\t"))
	file.close()

	var err := DirAccess.rename_absolute(SAVE_TMP_PATH, SAVE_PATH)
	if err != OK:
		push_error("SaveSystem: 替换存档失败（错误码 %d）" % err)
		DirAccess.remove_absolute(SAVE_TMP_PATH)
		return false

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
		# 没有对应迁移分支时不要把旧格式当新格式用，否则调用方会读到缺失/错型的字段
		push_warning("SaveSystem: 存档版本 %d 与当前版本 %d 不一致，已忽略该存档" % [version, SAVE_VERSION])
		return {}

	loaded.emit()
	return data


func has_save() -> bool:
	return FileAccess.file_exists(SAVE_PATH)


func delete_save() -> void:
	if has_save():
		DirAccess.remove_absolute(SAVE_PATH)
