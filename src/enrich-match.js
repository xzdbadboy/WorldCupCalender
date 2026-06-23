import axios from 'axios';

// 球队国旗映射（简化版）
const teamFlags = {
  'Mexico': '🇲🇽',
  'South Africa': '🇿🇦',
  'Argentina': '🇦🇷',
  'Austria': '🇦🇹',
  'France': '🇫🇷',
  'Iraq': '🇮🇶',
  'New Zealand': '🇳🇿',
  'Egypt': '🇪🇬',
  'Spain': '🇪🇸',
  'Saudi Arabia': '🇸🇦',
  'Belgium': '🇧🇪',
  'Iran': '🇮🇷',
  'Uruguay': '🇺🇾',
  'Cape Verde Islands': '🇨🇻',
  'Norway': '🇳🇴',
  'Senegal': '🇸🇳',
  'Portugal': '🇵🇹',
  'England': '🇬🇧',
  'Germany': '🇩🇪',
  'Netherlands': '🇳🇱',
  'Brazil': '🇧🇷',
  'Italy': '🇮🇹',
  'Japan': '🇯🇵',
  'South Korea': '🇰🇷',
  'Canada': '🇨🇦',
  'USA': '🇺🇸',
  'Australia': '🇦🇺',
  'Russia': '🇷🇺',
  'Poland': '🇵🇱',
  'Sweden': '🇸🇪',
  'Switzerland': '🇨🇭',
  'Uzbekistan': '🇺🇿',
  'Jordan': '🇯🇴',
  'Algeria': '🇩🇿',
  'Ghana': '🇬🇭',
  'Panama': '🇵🇦',
  'Croatia': '🇭🇷'
};

// 常见球员英文名 → 中文名映射（2026年世界杯）
const playerNameMap = {
  // Spain 西班牙
  'L Yamal': '亚马尔',
  'Lamine Yamal': '亚马尔',
  'M Oyarzabal': '奥亚萨瓦尔',
  'Mikel Oyarzabal': '奥亚萨瓦尔',
  'P Gavi': '加维',
  'Gavi': '加维',
  'Á Morata': '莫拉塔',
  'Álvaro Morata': '莫拉塔',
  'P Torres': '帕德里',
  'Pedri': '佩德里',
  'I Almada': '阿尔马达',
  // Egypt 埃及
  'M Salah': '萨拉赫',
  'Mohamed Salah': '萨拉赫',
  'M Zaki Abdelraouf': '扎基',
  'Trezeguet': '特雷泽盖',
  'T M Abdelghani': '特雷泽盖',
  'F Surman': '苏尔曼',
  'Fathi Surman': '苏尔曼',
  'K Nanny': '纳尼',
  // Saudi Arabia 沙特阿拉伯
  'C Al Najei': '阿尔纳杰',
  'S Al Shehri': '阿尔沙赫里',
  'A Al Dawsari': '阿尔道瑟里',
  // Uruguay 乌拉圭
  'M Araújo': '阿劳霍',
  'A Canobbio': '卡诺比奥',
  'C Cavani': '卡瓦尼',
  'Edinson Cavani': '卡瓦尼',
  'J Gimenez': '希梅内斯',
  // New Zealand 新西兰
  'Chris Wood': '克里斯·伍德',
  'C Wood': '伍德',
  // Belgium 比利时
  'K De Bruyne': '德布劳内',
  'Kevin De Bruyne': '德布劳内',
  'T Hazard': '哈扎德',
  'Thorgan Hazard': '托尔根·阿扎尔',
  'E Hazard': '阿扎尔',
  'Eden Hazard': '阿扎尔',
  'R Lukaku': '卢卡库',
  'Romelu Lukaku': '卢卡库',
  // France 法国
  'K Mbappe': '姆巴佩',
  'Kylian Mbappe': '姆巴佩',
  'A Griezmann': '格里兹曼',
  'Antoine Griezmann': '格里兹曼',
  'K Benzema': '本泽马',
  'Karim Benzema': '本泽马',
  'J Pogba': '博格巴',
  'Paul Pogba': '博格巴',
  'N Kanté': '坎特',
  'N Kante': '坎特',
  // Germany 德国
  'K Havertz': '哈弗茨',
  'Kai Havertz': '哈弗茨',
  'T Müller': '穆勒',
  'T Muller': '穆勒',
  'Thomas Müller': '穆勒',
  'J Gnabry': '格纳夫',
  'S Sané': '萨内',
  'L Sané': '萨内',
  // Argentina 阿根廷
  'L Messi': '梅西',
  'Lionel Messi': '梅西',
  'A Higuain': '伊瓜因',
  'Gonzalo Higuaín': '伊瓜因',
  'J Alvarez': '胡利安',
  'J Martinez': '马丁内斯',
  // England 英格兰
  'H Kane': '凯恩',
  'Harry Kane': '凯恩',
  'R Sterling': '斯特林',
  'Raheem Sterling': '斯特林',
  'P Foden': '福登',
  'Phil Foden': '福登',
  'M Mount': '芒特',
  // Brazil 巴西
  'Neymar': '内马尔',
  'Neymar Jr': '内马尔',
  'V Junior': '维尼修斯',
  'Vinicius Jr': '维尼修斯',
  'R Lewandowski': '莱万',
  'R Firmino': '菲尔米诺',
  'A Silva': '安德森·席尔瓦',
  // Netherlands 荷兰
  'S de Jong': '德容',
  'Sergiño Dest': '德斯特',
  'M Dumfries': '邓弗里斯',
  'L de Ligt': '德利赫特',
  // Portugal 葡萄牙
  'C Ronaldo': '克里斯蒂亚诺',
  'Cristiano Ronaldo': '克里斯蒂亚诺',
  'B Silva': '贝尔纳多',
  'Bernardo Silva': '贝尔纳多',
  'D Jota': '若塔',
  'J Cancelo': '坎塞洛',
  // Italy 意大利
  'A Immobile': '伊莫比莱',
  'Ciro Immobile': '伊莫比莱',
  'L Insigne': '因西涅',
  'L Bonucci': '博努奇',
  // Japan 日本
  'S Doan': '稻叶笃',
  'R Morishita': '森下稜平',
  'T Minamino': '南野拓実',
  // South Korea 韩国
  'Son Heung-min': '孙兴慜',
  'S Hwang': '黄喜灿',
  'Hwang Hee-chan': '黄喜灿',
  'K Lee': '李康仁',
  // Mexico 墨西哥
  'H Lozano': '洛萨诺',
  'A Pulido': '普利多',
  // Canada 加拿大
  'A David': '戴维',
  'Alphonso Davies': '戴维',
  // USA 美国
  'P Reyna': '雷纳',
  'Gio Reyna': '雷纳',
  'C Pulisic': '普利西奇',
  // Australia 澳大利亚
  'A Leckie': '莱基',
  'M Rogic': '罗吉奇',
  // Denmark 丹麦
  'C Eriksen': '埃里克森',
  'Christian Eriksen': '埃里克森',
  // Poland 波兰
  'R Lewandowski': '莱万多夫斯基',
  'Robert Lewandowski': '莱万多夫斯基',
  // Sweden 瑞典
  'Z Ibrahimović': '伊布',
  'Zlatan Ibrahimovic': '伊布',
  // Switzerland 瑞士
  'G Xhaka': '沙卡',
  'Granit Xhaka': '沙卡',
  // Netherlands 荷兰
  'W Weghorst': '韦格霍斯特',
  'Wout Weghorst': '韦格霍斯特',
  // Croatia 克罗地亚
  'L Modrić': '莫德里奇',
  'Luka Modrić': '莫德里奇',
  'I Rakitić': '拉基蒂奇',
  // Serbia 塞尔维亚
  'A Mitrović': '米特罗维奇',
  'Aleksandar Mitrović': '米特罗维奇',
  // Romania 罗马尼亚
  'G Hagi': '哈吉',
  // Norway 挪威
  'E Haaland': '哈兰德',
  'Erling Haaland': '哈兰德',
  // Senegal 塞内加尔
  'S Mané': '马内',
  'Sadio Mané': '马内',
  // Ghana 加纳
  'T Partey': '帕尔蒂',
  'Thomas Partey': '帕尔蒂',
  // Ivory Coast 科特迪瓦
  'W Zaha': '扎哈',
  'Wilfried Zaha': '扎哈',
  // Cameroon 喀麦隆
  'A Onana': '奥纳纳',
  'André Onana': '奥纳纳',
  // Algeria 阿尔及利亚
  'R Bentaleb': '本塔莱布',
  // Tunisia 突尼斯
  'H Sassi': '萨西',
  // Morocco 摩洛哥
  'A Ziyech': '齐耶赫',
  'H Ziyech': '齐耶赫',
  // Ecuador 厄瓜多尔
  'E Valencia': '瓦伦西亚',
  // Peru 秘鲁
  'C Cueva': '夸瓦',
  // Colombia 哥伦比亚
  'J Rodriguez': '罗德里格斯',
  'James Rodríguez': '罗德里格斯',
  // Panama 巴拿马
  'R Torres': '托雷斯',
  // Uruguay 乌拉圭
  'S Nutricelli': '努特里塞利',
  // Bolivia 玻利维亚
  'M Martins': '马丁斯'
};

function getPlayerChineseName(englishName) {
  // 直接查表
  if (playerNameMap[englishName]) {
    return playerNameMap[englishName];
  }

  // 尝试匹配简写（如 "L Yamal" 可能匹配 "Lamine Yamal"）
  for (const [key, value] of Object.entries(playerNameMap)) {
    if (key.includes(englishName) || englishName.includes(key)) {
      return value;
    }
  }

  // 找不到中文名则保留英文
  return englishName;
}

function getTeamFlag(teamName) {
  return teamFlags[teamName] || '⚽';
}

/**
 * 通过 anysearch API v1 搜索比赛进球详情
 * API: https://api.anysearch.com/v1/search
 * 认证: Authorization: Bearer {API_KEY}
 *
 * 请求格式:
 * POST https://api.anysearch.com/v1/search
 * {
 *   "query": "搜索词",
 *   "max_results": 5
 * }
 *
 * 响应格式:
 * {
 *   "code": 0,
 *   "message": "success",
 *   "data": {
 *     "results": [
 *       {
 *         "title": "标题",
 *         "snippet": "摘要",
 *         "content": "完整内容",
 *         "url": "链接"
 *       }
 *     ]
 *   }
 * }
 */
async function searchMatchGoals(match) {
  const { homeTeam, awayTeam, utcDate } = match;
  const matchDate = utcDate.split('T')[0];
  const apiKey = process.env.ANYSEARCH_API_KEY;

  if (!apiKey) {
    console.warn('[anysearch] API key 未配置，使用基础数据');
    return extractBasicGoals(match);
  }

  const expectedGoals = (match.score?.fullTime?.home || 0) + (match.score?.fullTime?.away || 0);

  // 构建多个搜索词，增加成功率
  const searchQueries = [
    `${homeTeam.name} vs ${awayTeam.name} goals scorers ${matchDate}`,
    `${homeTeam.name} ${awayTeam.name} match report goals`,
    `${homeTeam.name} ${awayTeam.name} final score`,
    `${homeTeam.name} ${awayTeam.name} 进球 得分者`,
    `${homeTeam.name} ${awayTeam.name} scorer`,
    `${homeTeam.name} goals ${matchDate}`
  ];

  let bestResult = { goals: [], cards: [] };

  for (const query of searchQueries) {
    console.log(`[anysearch] 搜索: ${query}`);

    try {
      const response = await axios.post('https://api.anysearch.com/v1/search', {
        query: query,
        max_results: 10
      }, {
        timeout: 10000,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      // 检查响应结构
      if (response.data && response.data.code === 0 && response.data.data?.results) {
        const goals = parseGoalsFromSearchResults(response.data.data.results, match);

        // 如果找到的进球数更多，则更新最佳结果
        if (goals.goals.length > bestResult.goals.length) {
          bestResult = goals;
          console.log(`[anysearch] 找到 ${goals.goals.length} 条进球信息`);

          // 如果找到了预期数量的进球，可以停止搜索
          if (goals.goals.length >= expectedGoals) {
            return goals;
          }
        }
      }

    } catch (error) {
      console.warn(`[anysearch] 搜索失败: ${error.message}`);
      continue;
    }
  }

  // 如果找到了一些进球，返回最好的结果
  if (bestResult.goals.length > 0) {
    console.log(`[anysearch] 最终找到 ${bestResult.goals.length} 条进球信息`);
    return bestResult;
  }

  // 所有查询都失败或没有找到，使用基础数据
  console.log(`[anysearch] 所有查询失败，使用基础比分数据`);
  return extractBasicGoals(match);
}

/**
 * 从 anysearch 搜索结果中解析进球信息
 */
function parseGoalsFromSearchResults(results, match) {
  const goals = [];
  const cards = [];

  if (!results || results.length === 0) {
    return { goals, cards };
  }

  // 遍历搜索结果
  for (const result of results) {
    // 优先使用 snippet 或 content
    const text = result.snippet || result.content || result.title || '';

    if (!text) continue;

    // 模式 1: "Name (44th minute)" / "Name (21st minute)" 等
    // 这是最可靠的格式，但需要智能地判断球队
    const namedGoalMatches = Array.from(text.matchAll(/([A-Za-z\s\.]+?)\s*\((\d{1,2})(?:th|st|nd|rd)\s+minute/gi));

    for (const m of namedGoalMatches) {
      let playerName = m[1].trim();
      const minute = parseInt(m[2]);
      const goalMatchPos = m.index;

      if (minute > 0 && minute < 120 && playerName.length > 1) {
        // 清理名字
        playerName = playerName.replace(/^[-\s]+|[-\s]+$/g, '').trim();

        if (playerName.length < 2) continue;

        if (!goals.some(g => g.minute === minute)) {
          // 根据比分和进球顺序推断球队
          // 这是一个启发式方法：根据已统计的进球数与预期的比分来判断
          const homeGoals = match.score?.fullTime?.home || 0;
          const goalsBeforeThisOne = goals.length;

          let team = null;
          if (goalsBeforeThisOne < homeGoals) {
            team = 'HOME';
          } else {
            team = 'AWAY';
          }

          goals.push({
            minute: minute,
            player: playerName,
            team: team,
            type: 'goal'
          });
        }
      }
    }

    // 匹配黄牌
    const yellowMatches = text.matchAll(/(\d{1,2})(?:th|st|nd|rd)?\s+(?:yellow card|yellow|🟡)/gi);
    for (const m of yellowMatches) {
      const minute = parseInt(m[1]);
      if (minute > 0 && minute < 120) {
        if (!cards.some(c => c.minute === minute && c.type === 'yellow')) {
          cards.push({
            minute: minute,
            player: null,
            team: null,
            type: 'yellow'
          });
        }
      }
    }

    // 匹配红牌
    const redMatches = text.matchAll(/(\d{1,2})(?:th|st|nd|rd)?\s+(?:red card|red|sent off|🔴)/gi);
    for (const m of redMatches) {
      const minute = parseInt(m[1]);
      if (minute > 0 && minute < 120) {
        if (!cards.some(c => c.minute === minute && c.type === 'red')) {
          cards.push({
            minute: minute,
            player: null,
            team: null,
            type: 'red'
          });
        }
      }
    }
  }

  return { goals: removeDuplicates(goals), cards };
}

/**
 * 去重函数
 */
function removeDuplicates(goals) {
  return goals.filter((g, i, arr) => arr.findIndex(x => x.minute === g.minute) === i);
}

/**
 * 从 FIFA API 返回的基础数据中提取进球信息
 */
function extractBasicGoals(match) {
  const goals = [];
  const { score } = match;

  // API 只提供最终比分，无时间信息
  if (score.fullTime.home > 0) {
    for (let i = 0; i < score.fullTime.home; i++) {
      goals.push({
        minute: null,
        player: null,
        team: 'HOME',
        type: 'goal'
      });
    }
  }

  if (score.fullTime.away > 0) {
    for (let i = 0; i < score.fullTime.away; i++) {
      goals.push({
        minute: null,
        player: null,
        team: 'AWAY',
        type: 'goal'
      });
    }
  }

  return { goals, cards: [] };
}

/**
 * 格式化进球摘要为字符串
 */
function formatGoalsSummary(goalDetails, match) {
  const { goals, cards } = goalDetails;

  if (!goals || goals.length === 0) {
    return '';
  }

  // 限制进球数量不超过比赛的实际进球总数
  const maxGoals = (match.score?.fullTime?.home || 0) + (match.score?.fullTime?.away || 0);
  const limitedGoals = goals.slice(0, maxGoals);

  // 按时间排序进球
  limitedGoals.sort((a, b) => (a.minute || 999) - (b.minute || 999));

  let summary = '';

  // 格式化进球：时间 + 人员中文名 + 国旗
  for (const goal of limitedGoals) {
    const minute = goal.minute ? `${goal.minute}'` : '?';

    // 将英文球员名转换为中文
    const playerName = goal.player ? getPlayerChineseName(goal.player) : '';
    const player = playerName ? ` ${playerName}` : '';

    // 根据球队获取国旗
    let flag = '';
    if (goal.team === 'HOME') {
      flag = getTeamFlag(match.homeTeam.name);
    } else if (goal.team === 'AWAY') {
      flag = getTeamFlag(match.awayTeam.name);
    }

    summary += `${minute}${player} ${flag}\n`;
  }

  // 添加黄牌/红牌信息
  for (const card of cards) {
    const minute = card.minute ? `${card.minute}'` : '?';
    const symbol = card.type === 'yellow' ? '🟡' : '🔴';
    summary += `${minute} ${symbol}\n`;
  }

  return summary.trim();
}

/**
 * 增强比赛数据：添加进球详情
 */
export async function enrichMatchWithDetails(match) {
  const goalDetails = await searchMatchGoals(match);

  // 检查进球数是否完整
  const expectedGoals = (match.score?.fullTime?.home || 0) + (match.score?.fullTime?.away || 0);
  const foundGoals = goalDetails.goals.length;

  // 如果找到的进球少于预期，用基础数据补充缺失的进球
  if (foundGoals < expectedGoals) {
    console.log(`[补充] 找到 ${foundGoals} 个进球，缺 ${expectedGoals - foundGoals} 个，使用基础数据补充`);
    const basicGoals = extractBasicGoals(match);

    // 合并：优先使用有时间和人员信息的进球，然后补充没有信息的进球
    const enrichedGoals = [...goalDetails.goals];
    const existingMinutes = new Set(enrichedGoals.map(g => g.minute).filter(m => m));

    for (const basicGoal of basicGoals.goals) {
      if (enrichedGoals.length < expectedGoals) {
        // 添加缺失的进球（作为没有时间的进球）
        enrichedGoals.push(basicGoal);
      }
    }

    goalDetails.goals = enrichedGoals;
  }

  const goalsSummary = formatGoalsSummary(goalDetails, match);

  return {
    ...match,
    goalDetails,
    goalsSummary
  };
}
