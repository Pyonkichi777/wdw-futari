import { MEAL_LABEL } from "../data/dining";
import { toggleMeal } from "../lib/meals";
import type { MealPeriod, Ride } from "../types";

interface Props {
  ride: Ride;
  value: readonly MealPeriod[] | undefined;
  onChange: (meals: MealPeriod[]) => void;
}

/** レストランに「行くならいつ？」（複数可）。日ごとの計画で、どの時間帯に入れるかの材料にする */
export function MealPicker({ ride, value, onChange }: Props) {
  const meals = ride.dining?.meals ?? [];
  if (meals.length === 0) return null;
  const only = meals[0];
  if (meals.length === 1 && only !== undefined) {
    return <p className="meal-pick only">🍽 この店でキャラクターに会えるのは{MEAL_LABEL[only]}だけ</p>;
  }
  return (
    <div className="meal-pick">
      <span className="meal-pick-label">🍽 行くならいつ？（複数可）</span>
      <div className="chips wrap" role="group" aria-label={`${ride.nameJa}に行くならいつ`}>
        {meals.map((m) => {
          const on = value?.includes(m) ?? false;
          return (
            <button key={m} aria-pressed={on} className={on ? "chip on" : "chip"} onClick={() => onChange(toggleMeal(value, m))}>
              {on ? "✓ " : ""}
              {MEAL_LABEL[m]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 選んだ時間帯の表示（相手の回答・合意リスト用） */
export const mealText = (meals: readonly MealPeriod[] | undefined): string =>
  meals && meals.length > 0 ? meals.map((m) => MEAL_LABEL[m]).join("・") : "時間帯の希望なし";
