import { GESIndicator } from "../GES_Curriculum";
import { CareerTechnology } from "./CareerTechnology";
import { Computing } from "./Computing";
import { CreativeArts } from "./CreativeArts";
import { English } from "./English";
import { History } from "./History";
import { Mathematics } from "./Mathematics";
import { RME } from "./RME";
import { Science } from "./Science";
import { SocialStudies } from "./SocialStudies";

export const GES_CURRICULUM_DATA: Record<
  string,
  Record<string, GESIndicator[]>
> = {
  Mathematics: Mathematics,
  Maths: Mathematics,
  Science: Science,
  "Integrated Science": Science,
  English: English,
  "English Language": English,
  Computing: Computing,
  ICT: Computing,
  "Our World and Our People (OWOP)": SocialStudies,
  OWOP: SocialStudies,
  "Our World and Our People": SocialStudies,
  "Social Studies": SocialStudies,
  "Religious and Moral Education (RME)": RME,
  RME: RME,
  "Religious and Moral Education": RME,
  History: History,
  "History of Ghana": History,
  "Career Technology": CareerTechnology,
  "Career Tech": CareerTechnology,
  "Design and Technology": CareerTechnology,
  "Creative Arts": CreativeArts,
  "Creative Arts and Design": CreativeArts,
};
