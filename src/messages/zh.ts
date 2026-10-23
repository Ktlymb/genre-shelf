// 全部界面文案集中在这里（§1.2：为以后加英文留口子）

export const zh = {
  app: {
    name: 'Genre Shelf',
  },
  validate: {
    required: (field: string) => `「${field}」必填`,
    regionOnlyForGc: '只有归属为「大中华地区」时才能填写籍贯',
    unknownRegion: (code: string) => `籍贯 ${code} 不存在`,
    unknownCountry: (code: string) => `国家/地区 ${code} 不存在或已删除`,
    unknownType: '书籍类型不存在或已删除',
    authorRequired: '至少需要一位作者',
    authorMissing: (id: string) => `作者 ${id} 不存在或已删除`,
    authorDuplicate: (name: string) => `已有同名作者「${name}」`,
    authorInUse: (n: number) => `还有 ${n} 本书引用这位作者，不能删除`,
    typeCodeFormat: '简称必须是 4 位大写字母',
    typeCodeDuplicate: (code: string) => `简称 ${code} 已被其他类型使用`,
    typeInUse: (n: number) => `还有 ${n} 本书使用这个类型，不能删除`,
    colorFormat: '颜色必须是 #RRGGBB 格式',
    dateFormat: '日期必须是 YYYY-MM-DD 格式',
    ratingRange: '评分必须是 1 到 5',
    wordCount: '字数必须是不小于 0 的整数',
    yearInteger: '创作年份必须是整数',
    codeDuplicate: (code: string) => `代码 ${code} 重复`,
    mapCodeUnknown: (code: string) => `着色范围里的 ${code} 在地图上不存在`,
    mergeOverlap: (member: string, owner: string, other: string) =>
      `色块 ${member} 属于合并显示的「${owner}」，不能再被「${other}」覆盖`,
    mergeHistorical: '历史国家不能开启合并显示',
  },
} as const;
