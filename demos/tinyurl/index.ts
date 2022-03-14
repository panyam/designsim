import "./styles/global";
import ExercisePage from "../uilib/ExercisePage";
import { Setup as V1Setup } from "./exercises/v1/setup";
import { Setup as V2Setup } from "./exercises/v2/setup";

$(() => {
  const page = ((window as any).page = new ExercisePage());
  V1Setup(page);
  V2Setup(page);
});
