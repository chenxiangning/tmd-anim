/** 外部修改冲突横幅:守卫写已拒写,盘上保留外部版本;用户二选一,默认不动盘。 */
export function SaveConflictBar({
  onAdoptDisk,
  onKeepMine,
}: {
  onAdoptDisk(): void;
  onKeepMine(): void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
      <span className="font-semibold">文件已被外部修改(可能是 coding agent)</span>
      <span className="text-amber-700">自动保存已暂停,你的未保存改动没有覆盖盘上内容,请选择:</span>
      <button className="btn btn-secondary px-2 py-1 text-xs" onClick={onAdoptDisk}>
        载入盘上版本(丢弃本地未保存改动)
      </button>
      <button className="btn btn-primary px-2 py-1 text-xs" onClick={onKeepMine}>
        用编辑器版本覆盖
      </button>
    </div>
  );
}
