import { Mathematics } from "./Mathematics";
import { Science } from "./Science";
import { English } from "./English";
import { Computing } from "./Computing";
import { SocialStudies } from "./SocialStudies";
import { RME } from "./RME";
import { History } from "./History";
import { CareerTechnology } from "./CareerTechnology";
import { CreativeArts } from "./CreativeArts";
import { GESIndicator } from "../GES_Curriculum";

export const GES_CURRICULUM_DATA: Record<string, Record<string, GESIndicator[]>> = {
  "Mathematics": Mathematics,
  "Science": Science,
  "English": English,
  "Computing": Computing,
  "Social Studies": SocialStudies,
  "Religious and Moral Education (RME)": RME,
  "History": History,
  "Career Technology": CareerTechnology,
  "Creative Arts": CreativeArts,
  "Creative Arts and Design": CreativeArts,
};
