/* ============================================================
 * js/poems.js —— 《雙洲鄒氏族譜注》诗文数据（2026-10-27）
 * 诗行按《20261027-族谱诗文-原文摘录.md》补全为全篇；不改字、不补今译。
 * OCR 待核字照录；陈文炳《墨斗先茔》仅 7 句，待纸书核对。
 * ============================================================ */
window.ZOU_POEMS = {
  "meta": {
    "source": "《双洲邹氏族谱注》，2026 年编注本",
    "note": "样张数据，供 05 八景卡与诗路地图使用；页码为纸书印刷页码。OCR 个别字待与纸书复核。",
    "updated": "2026-10-27",
    "coordsNote": "scenes[].coords 为族人提供的概略坐标（约 115.3908–115.4051 / 27.9076–27.9248，八点散布约 1.4×1.9 km），非实测精测值；③号图以带圈序号标注，待补实景图与精确坐标后替换。",
    "fullText": {
      "note": "诗行已按《族谱诗文原文摘录》补全：清诗 8 首、今咏 8 首均为全篇；OCR 待核字照录未改。",
      "updated": "2026-10-27",
      "pending": "《墨斗先茔》（陈文炳）摘录本仅 7 句，疑 OCR 脱一句，待纸书核对。"
    }
  },
  "scenes": [
    {
      "id": "sanjian",
      "order": 1,
      "name": "三江远渡",
      "alias": "三江口古渡",
      "coords": [
        115.404135,
        27.913076
      ],
      "displayName": "三江远渡"
    },
    {
      "id": "raowu",
      "order": 2,
      "name": "绕户垂柑",
      "alias": "绕屋垂柑",
      "coords": [
        115.402855,
        27.913651
      ],
      "displayName": "绕户垂柑"
    },
    {
      "id": "youzhou",
      "order": 3,
      "name": "游洲牧笛",
      "alias": "游家洲",
      "coords": [
        115.405091,
        27.924752
      ],
      "displayName": "游洲牧笛"
    },
    {
      "id": "huangtang",
      "order": 4,
      "name": "黄塘春鲤",
      "alias": "黄塘",
      "coords": [
        115.404026,
        27.914188
      ],
      "displayName": "黄塘春鲤"
    },
    {
      "id": "gumiao",
      "order": 5,
      "name": "古庙晨钟",
      "alias": "慈济寺/古庙",
      "coords": [
        115.390795,
        27.909049
      ],
      "displayName": "古庙晨钟"
    },
    {
      "id": "huacheng",
      "order": 6,
      "name": "花塍曲径",
      "alias": "花胜曲径",
      "coords": [
        115.402875,
        27.920333
      ],
      "displayName": "花胜曲径"
    },
    {
      "id": "zengkeng",
      "order": 7,
      "name": "曾坑虹桥",
      "alias": "曾坑桥",
      "coords": [
        115.395392,
        27.907645
      ],
      "displayName": "曾坑虹桥"
    },
    {
      "id": "modou",
      "order": 8,
      "name": "墨斗先茔",
      "alias": "墨斗山",
      "coords": [
        115.400684,
        27.912552
      ],
      "displayName": "墨斗先茔"
    }
  ],
  "poems": [
    {
      "id": "sz-sanjian-qing",
      "sceneId": "sanjian",
      "set": "shuangzhou",
      "dynasty": "清",
      "author": "罗存礼",
      "title": "双洲八景诗·三江远渡",
      "lines": [
        "村前村后映清流，无限风光与目谋。",
        "芳树参差开四面，征帆往复挂双洲。",
        "侵晨欸乃闻舟楫，入夜菁华焕斗牛。",
        "过客偶临沙口堰，如襟似带乐攸攸。"
      ],
      "excerptCount": 8,
      "notes": [
        {
          "term": "与目谋",
          "text": "入目、入眼，与视线相遇，贴合观赏心境。"
        },
        {
          "term": "参差",
          "text": "高低不齐、错落有致。"
        }
      ],
      "source": {
        "page": 75
      },
      "full": true
    },
    {
      "id": "sz-sanjian-jin",
      "sceneId": "sanjian",
      "set": "shuangzhou",
      "dynasty": "今",
      "author": "邹嘉旺",
      "title": "双洲八景新咏·三江远渡",
      "lines": [
        "古渡横江接远天，征帆曾映碧涛前。",
        "旧渡已随秋岁改，东昌飞架袁河桥。",
        "三江口起长虹影，新堤柳舞锁寒烟。",
        "凭栏遥忆当年事，逝水悠悠思万千。"
      ],
      "excerptCount": 8,
      "notes": [
        {
          "term": "东昌",
          "text": "桥名，待与纸书复核；一作地名。"
        }
      ],
      "source": {
        "page": 31
      },
      "full": true
    },
    {
      "id": "sz-raowu-qing",
      "sceneId": "raowu",
      "set": "shuangzhou",
      "dynasty": "清",
      "author": "罗存礼",
      "title": "双洲八景诗·绕屋垂柑",
      "lines": [
        "红红绿绿缀林端，景况扶疏耐岁寒。",
        "渡口余霞疑映带，枝头润露爱盘桓。",
        "许多星实临平野，无限风香送远峦。",
        "肇锡嘉名闻橘柚，分甘妇子倚圆栏。"
      ],
      "excerptCount": 8,
      "notes": [
        {
          "term": "扶疏",
          "text": "枝叶茂盛、高低疏密有致。"
        }
      ],
      "source": {
        "page": 75
      },
      "full": true
    },
    {
      "id": "sz-raowu-jin",
      "sceneId": "raowu",
      "set": "shuangzhou",
      "dynasty": "今",
      "author": "邹嘉旺",
      "title": "双洲八景新咏·绕户垂柑",
      "lines": [
        "罗浮佳种绕庭前，翠叶凝香几百年。",
        "古木留春承旧韵，新枝缀果续清缘。",
        "昔时户户盈芳气，今日株株记昔贤。",
        "不羡繁花争艳丽，甘将清味润乡田。"
      ],
      "excerptCount": 8,
      "notes": [],
      "source": {
        "page": 31
      },
      "full": true
    },
    {
      "id": "sz-youzhou-qing",
      "sceneId": "youzhou",
      "set": "shuangzhou",
      "dynasty": "清",
      "author": "罗存礼",
      "title": "双洲八景诗·游洲牧笛",
      "lines": [
        "江村碧草占幽芳，童子传声入耳旁。",
        "断续河干收宿雨，宽闲牛背趁斜阳。",
        "音流象外新柑熟，响彻村边晚稻香。",
        "柳暗花明多胜概，悠悠驱犊一犁黄。"
      ],
      "excerptCount": 8,
      "notes": [],
      "source": {
        "page": 77
      },
      "full": true
    },
    {
      "id": "sz-youzhou-jin",
      "sceneId": "youzhou",
      "set": "shuangzhou",
      "dynasty": "今",
      "author": "邹嘉旺",
      "title": "双洲八景新咏·游洲牧笛",
      "lines": [
        "牧笛悠扬绕洲边，牛蹄踏翠忆从前。",
        "青芜曾映童颜笑，竹管犹传旧调绵。",
        "野径风轻藏古韵，闲田草盛寄新篇。",
        "故园清景今犹在，不见当年吹笛仙。"
      ],
      "excerptCount": 8,
      "notes": [],
      "source": {
        "page": 31
      },
      "full": true
    },
    {
      "id": "sz-huangtang-qing",
      "sceneId": "huangtang",
      "set": "shuangzhou",
      "dynasty": "清",
      "author": "罗存礼",
      "title": "双洲八景诗·黄塘春鲤",
      "lines": [
        "频临南浦羡嘉鱼，浪暖桃花意自如。",
        "好雨池心资长养，轻风水面助吹嘘。",
        "他时摇尾依蒲早，此日游鳞在藻初。",
        "倘付烹鲜酬素愿，何妨结网出吾庐。"
      ],
      "excerptCount": 8,
      "notes": [
        {
          "term": "南浦",
          "text": "南面的水边，泛指送别、临水之地。"
        }
      ],
      "source": {
        "page": 77
      },
      "full": true
    },
    {
      "id": "sz-huangtang-jin",
      "sceneId": "huangtang",
      "set": "shuangzhou",
      "dynasty": "今",
      "author": "邹嘉旺",
      "title": "双洲八景新咏·黄塘春鲤",
      "lines": [
        "黄塘清浅忆当年，鲤跃鸢飞景自妍。",
        "浣女临溪裁秀色，渔翁把钓伴晴烟。",
        "池平难觅当年浪，岸古犹存旧日泉。",
        "唯有春风依旧暖，犹思胜景润心田。"
      ],
      "excerptCount": 8,
      "notes": [],
      "source": {
        "page": 31
      },
      "full": true
    },
    {
      "id": "sz-gumiao-qing",
      "sceneId": "gumiao",
      "set": "shuangzhou",
      "dynasty": "清",
      "author": "罗存礼",
      "title": "双洲八景诗·古庙晨钟",
      "lines": [
        "神坛正直且聪明，响彻沧洲晓梦惊。",
        "赫濯声灵原久振，崔巍气象宛如生。",
        "凭依福地非无素，省识迷途大有情。",
        "乍觉清音方入耳，辜生回首早存诚。"
      ],
      "excerptCount": 8,
      "notes": [],
      "source": {
        "page": 77
      },
      "full": true
    },
    {
      "id": "sz-gumiao-jin",
      "sceneId": "gumiao",
      "set": "shuangzhou",
      "dynasty": "今",
      "author": "邹嘉旺",
      "title": "双洲八景新咏·古庙晨钟",
      "lines": [
        "古寺残碑立翠巅，晨钟余韵忆从前。",
        "清音曾透千层雾，香火犹萦半亩天。",
        "断壁留痕藏旧事，新亭寄意续尘缘。",
        "祖恩永记传千古，暮鼓晨钟慰岁年。"
      ],
      "excerptCount": 8,
      "notes": [],
      "source": {
        "page": 32
      },
      "full": true
    },
    {
      "id": "sz-huacheng-qing",
      "sceneId": "huacheng",
      "set": "shuangzhou",
      "dynasty": "清",
      "author": "罗存礼",
      "title": "双洲八景诗·花塍曲径",
      "lines": [
        "寻芳梓里兴弥奢，平步逍遥爱物华。",
        "摘艳只疑春一色，闻香莫辨路三叉。",
        "翩跹粉蝶相邀侣，来往黄蜂迭报衙。",
        "回首故园游赏地，倾触旨酒乐无涯。"
      ],
      "excerptCount": 8,
      "notes": [
        {
          "term": "花塍",
          "text": "花田的田埂；今咏作“花胜”，异文待考。"
        }
      ],
      "source": {
        "page": 77
      },
      "full": true
    },
    {
      "id": "sz-huacheng-jin",
      "sceneId": "huacheng",
      "set": "shuangzhou",
      "dynasty": "今",
      "author": "邹嘉旺",
      "title": "双洲八景新咏·花胜曲径",
      "lines": [
        "曲径蜿蜒接古阡，繁花曾缀旧庭边。",
        "幽兰吐蕊凝清韵，翠草含烟忆昔贤。",
        "旧径犹存苔印浅，新芳难续旧时妍。",
        "凭风暗寄怀乡意，一寸清愁伴岁迁。"
      ],
      "excerptCount": 8,
      "notes": [
        {
          "term": "花胜",
          "text": "谱注今咏作“花胜”，清诗作“花塍”，二字异文。"
        }
      ],
      "source": {
        "page": 31
      },
      "full": true
    },
    {
      "id": "sz-zengkeng-qing",
      "sceneId": "zengkeng",
      "set": "shuangzhou",
      "dynasty": "清",
      "author": "罗存礼",
      "title": "双洲八景诗·曾坑虹桥",
      "lines": [
        "舆梁自古告功成，南北东西不乏人。",
        "跨马无殊遵坦道，驱车勿待问通津。",
        "遥闻高岭鸣栖鸟，俯察深渊濯锦鳞。",
        "揽胜云衢华彩彻，吾侪咫尺出风尘。"
      ],
      "excerptCount": 8,
      "notes": [
        {
          "term": "舆梁",
          "text": "桥梁。"
        }
      ],
      "source": {
        "page": 77
      },
      "full": true
    },
    {
      "id": "sz-zengkeng-jin",
      "sceneId": "zengkeng",
      "set": "shuangzhou",
      "dynasty": "今",
      "author": "邹嘉旺",
      "title": "双洲八景新咏·曾坑虹桥",
      "lines": [
        "虹桥残影入云边，曾跨双洲接远天。",
        "石栏刻韵留清迹，古樟凝荫记旧年。",
        "逝水难回桥畔景，新风又润岸头烟。",
        "残碑未改当年色，犹载沧桑入卷篇。"
      ],
      "excerptCount": 8,
      "notes": [],
      "source": {
        "page": 32
      },
      "full": true
    },
    {
      "id": "sz-modou-qing",
      "sceneId": "modou",
      "set": "shuangzhou",
      "dynasty": "清",
      "author": "陈文炳",
      "title": "双洲八景诗·墨斗先茔",
      "lines": [
        "规矩方员显著形，有本辉联前代墓，无穷泽被后人丁。",
        "回环水转三湾绿，磊落山横四野青。",
        "得手应心成结构，华堂藻采靓余馨。"
      ],
      "excerptCount": 7,
      "notes": [
        {
          "term": "墨斗",
          "text": "墨斗山，形如木匠墨斗，故以为名。"
        }
      ],
      "source": {
        "page": 78
      },
      "full": false
    },
    {
      "id": "sz-modou-jin",
      "sceneId": "modou",
      "set": "shuangzhou",
      "dynasty": "今",
      "author": "邹嘉旺",
      "title": "双洲八景新咏·墨斗先茔",
      "lines": [
        "平洋穴结墨斗形，佳城兆吉护宗灵。",
        "松风暗伴先贤魄，柏影长留后世馨。",
        "旧碑载德传千古，新露凝恩润万丁。",
        "祖脉绵延承古韵，家声永振耀新庭。"
      ],
      "excerptCount": 8,
      "notes": [],
      "source": {
        "page": 32
      },
      "full": true
    }
  ],
  "hushan": [
    {
      "order": 1,
      "name": "东村古桂",
      "note": "桂树繁花、香满东村，以桂喻贤，留枝待士，崇文重道。"
    },
    {
      "order": 2,
      "name": "西汊春涛",
      "note": "春雷骤雨、水暖浪生，喻鱼龙变化，寄士人进取之志。"
    },
    {
      "order": 3,
      "name": "荷湖香露",
      "note": "夏日荷菱、晓露清香，记骑马临湖之闲适。"
    },
    {
      "order": 4,
      "name": "钟井寒泉",
      "note": "清泉长涌、莹洁如玉，取“盈科而进”之义，喻修身进德。"
    },
    {
      "order": 5,
      "name": "松山鹤唳",
      "note": "长松碧山、夜月鹤鸣，写绝尘清幽之境。"
    },
    {
      "order": 6,
      "name": "并窟龙潜",
      "note": "龙窟幽深、月明龙吟，祈神龙作霖，怀忧民济世之心。"
    },
    {
      "order": 7,
      "name": "神祠钟韵",
      "note": "祠宇巍巍、钟鸣晓暮，醒世省身。"
    },
    {
      "order": 8,
      "name": "芸闱书声",
      "note": "书阁芸香、诵读不辍，追慕唐虞盛世。"
    }
  ],
  "prose": [
    {
      "id": "youjiazhou-xu",
      "title": "游家洲序",
      "author": "今人文言（邹嘉旺）",
      "source": {
        "page": 4
      },
      "opening": "赣江古川，滥觞新淦，迤逦北注，汇横河于龙窝口；萦洄万硕洲南侧，西旋曲折，经三江口而入袁河，昔为赣江旧故道。",
      "note": "双洲地理总述，适合作为“进入双洲”的第一篇精读。"
    },
    {
      "id": "xiju-ji",
      "title": "双洲有宗翁徙居记",
      "author": "明·刘正亨",
      "source": {
        "page": 11
      },
      "opening": "此地横广宽大，袁赣二水环绕四周，清浊分明、界限清晰……有宗翁遂相阴阳、定居址，启建屋宇，携妻子儿女一同迁居于此。",
      "note": "迁徙决策全过程，适合与 03/04 的路线联动。"
    },
    {
      "id": "zhongming",
      "title": "清江慈济寺月桥铭并序·钟铭",
      "author": "谱注转录",
      "source": {
        "page": 2
      },
      "opening": "江之芮，不可以扬，不可以扬，有坦斯济；民之聪，不可以虹，不可以虹，有镗斯钟。鼓钟铿铿，震彼冥行。",
      "note": "适合做 05 或谱序长卷的卷首题眼。"
    }
  ]
};
