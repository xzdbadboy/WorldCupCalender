# 世界杯比赛日历iCal订阅

本项目改编自 [lizijing98/world-cup-cal](https://github.com/lizijing98/world-cup-cal)，基础功能已通过北京时间本地化和实时比赛监控进行增强。

## 使用方式

在支持ics订阅的软件中订阅下方提供的订阅地址, 如 iPhone/Mac/Android中的日历App、Outlook、Google 日历. 如果软件有自动更新订阅的设置, 推荐改为每日更新.

<center>
  <img src="./imgs/iPhone_1.jpeg" width=45%>
  <img src="./imgs/iPhone_2.jpeg" width=45%>
</center>

<center>
  <img src="./imgs/mac_1.png" width=90%>
  <img src="./imgs/mac_2.png" width=90%>
  <img src="./imgs/outlook.png" width=90%>
  <img src="./imgs/google.png" width=90%>
</center>

## 服务订阅

订阅ics文件可主动更新，推荐使用此方法订阅


* github订阅地址(GFW内不稳定需代理): 

> https://raw.githubusercontent.com/lizijing98/world-cup-cal/master/WorldCupSchedule.ics

## 更新

- 2026-01-23
  * 更新了2026美加墨世界杯的ics文件

- 2026-03-01
  * 重构项目, 通过接口获取数据
  * 新增Github Actions, 自动更新ics文件

- 2026-04-02
  * 更新2026年美加墨的全部参赛队伍
  * 新增自动发布Release的Github Actions

- 2026-06-13
  * 修改GitHub Actions的触发时间为北京时间12:10
  * 修改README, jsdelivr链接增加master分支标识

## 隐私与安全

### 数据处理

* 🔐 **无用户数据收集**：本项目仅处理公开的世界杯赛程数据
* 📡 **API 调用**：调用 [football-data.org](https://www.football-data.org/) 获取官方赛事数据
* 🔍 **目标搜索**：使用 anysearch API 查询比赛进球信息（可选功能）
* 💾 **本地存储**：所有缓存和状态仅存储在本地 `.state/` 和 `cache/` 目录

### 敏感信息保护

* ✅ **环境变量隔离**：所有 API 密钥通过 `.env` 文件管理，**绝不提交到 git**
* ✅ **.gitignore 配置**：`.env`、`.state/`、`cache/` 等均在忽略列表中
* ✅ **无硬编码密钥**：源代码中不包含任何密钥或敏感信息
* ✅ **权限设置**：`.env` 文件设置为 600 权限（仅所有者可读）

### 部署建议

* 🔒 **GitHub Actions**：密钥通过 Secrets 管理，不在日志中显示
* 🔒 **本地运行**：确保 `.env` 文件权限正确，不共享 `.env` 文件内容
* 🔒 **定期审查**：定期检查 API 使用配额和日志

## 相关资源

* 原项目：[lizijing98/world-cup-cal](https://github.com/lizijing98/world-cup-cal)
* 数据来源：[football-data.org](https://www.football-data.org/)
* iCal 标准：[RFC 5545](https://tools.ietf.org/html/rfc5545)
