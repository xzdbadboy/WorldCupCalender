/**
 * 增强比赛数据（简化版）
 * 直接返回原始比赛数据，不需要搜索进球详情
 *
 * @deprecated 自固定 20 分钟检查架构（commit 6551341）后不再使用。
 *             原 anysearch 搜索进球详情功能已移除。
 *             保留此文件以防未来需要恢复比分详情增强功能。
 */
export function enrichMatchWithDetails(match) {
  return match;
}
