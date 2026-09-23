# 海水缸盐度校准与补水放行台

海水缸盐度校准登记、规则判定与自动补水整批放行。原型由「水族箱水质监测」改造。

## 放行规则

- 盐度（比重 SG）超出 **1.023–1.026** 区间：禁止补水
- 温度偏离该缸目标温度超过 **0.5°C**：禁止补水
- 校准超过 **7 天**有效期：禁止补水
- 补水量按盐度差估算：`V补 = 缸水量 × (当前SG − 1.025) / 1.025`，盐度不高于目标 1.025 时无需补水
- **整批放行**：任一缸补水量超过其补水桶当前余量，整批退回，不扣减任何余量
- **同日每缸仅一条有效校准**：同日重开视为修正，必须填写原因；旧数值原样另存（仅状态转为已替代）
- 校准确认后数值与版本即刻冻结、永不改写；版本号按缸递增
- 每次补水放行都挂在具体冻结版本上，可回溯

## 分层结构（数据 / 计算 / 存储 / 页面）

```
src/
  data/
    types.ts              # 领域模型（缸、校准版本、补水流水）
  domain/
    rules.ts              # 规则常量与纯函数：盐度/温度/过期判定、同日判定
    calculation.ts        # 纯函数：补水量估算、单缸评估、整批放行判定
  store/
    repository.ts         # localStorage 读写（持久化唯一入口）
    seedData.ts           # 演示数据
    stationReducer.ts     # 状态机：冻结、同日修正、整批放行、登记新缸
    useStation.ts         # React 状态绑定
  pages/
    StationPage.tsx       # 页面编排（不含业务规则）
    components/
      CalibrationForm.tsx # 校准登记 / 重开修正
      ReleaseBoard.tsx    # 放行台：可放行清单、整批放行、受阻清单
      TankOverview.tsx    # 每缸登记台账
      VersionArchive.tsx  # 校准版本归档与修正留痕
      TopUpLedger.tsx     # 补水流水（与版本对应）
```

受阻清单固定展示：**鱼缸、盐度、桶余量、受阻规则**。

## 本地运行

```bash
npm install
npm run dev
```

开发端口：5105。数据保存在浏览器 localStorage（key: `reef-release-station:v1`），页面右上角「恢复演示数据」可重置。

## 技术栈

React + Vite + TypeScript + CSS
