#!/bin/bash
# 世界杯监控自动调度脚本

PROJECT_DIR="/Volumes/Personal/WorldCupCalender"
STATE_FILE="$PROJECT_DIR/.state/tracker.json"

# 提取下次检查时间
if [ -f "$STATE_FILE" ]; then
  NEXT_CHECK=$(jq -r '.nextScheduledCheck' "$STATE_FILE")
  
  if [ ! -z "$NEXT_CHECK" ] && [ "$NEXT_CHECK" != "null" ]; then
    echo "✅ 下次检查时间已确定"
    echo "时间: $NEXT_CHECK"
    
    # 可以基于 $NEXT_CHECK 创建新的 CronCreate 任务
    # 或输出给 Claude Code 的自动化系统
    echo "$NEXT_CHECK"
  fi
fi
