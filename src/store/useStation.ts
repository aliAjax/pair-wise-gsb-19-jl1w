// 存储层与页面之间的 React 绑定：状态唯一入口
import { useEffect, useMemo, useReducer } from "react";
import { loadState, saveState } from "./repository";
import { stationReducer, type Action } from "./stationReducer";

export function useStation() {
  const [state, dispatch] = useReducer(stationReducer, undefined, loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const actions = useMemo(
    () => ({
      confirmCalibration: (
        input: Extract<Action, { type: "confirm-calibration" }>["input"],
        correctionReason?: string,
      ) => dispatch({ type: "confirm-calibration", input, correctionReason }),
      release: (items: Extract<Action, { type: "release" }>["items"]) =>
        dispatch({ type: "release", items }),
      addTank: (tank: Extract<Action, { type: "add-tank" }>["tank"]) =>
        dispatch({ type: "add-tank", tank }),
      reset: () => dispatch({ type: "reset" }),
    }),
    [],
  );

  return { state, actions };
}
