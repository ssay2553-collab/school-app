import { Mathematics } from "./Mathematics";
import { Science } from "./Science";
import { English } from "./English";
import { Computing } from "./Computing";
import { SocialStudies } from "./SocialStudies";
import { RME } from "./RME";
import { History } from "./History";
import { CareerTechnology } from "./CareerTechnology";
import { CreativeArts } from "./CreativeArts";
import { French } from "./French";
import { PhysicalEducation } from "./PhysicalEducation";
import { GhanaianLanguage } from "./GhanaianLanguage";
import { GESIndicator } from "../GES_Curriculum";

export const GES_CURRICULUM_DATA: Record<string, Record<string, GESIndicator[]>> = {
  "Mathematics": Mathematics,
  "Maths": Mathematics,
  "Science": Science,
  "Integrated Science": Science,
  "English": English,
  "English Language": English,
  "Computing": Computing,
  "ICT": Computing,
  "Social Studies": SocialStudies,
  "Religious and Moral Education (RME)": RME,
  "RME": RME,
  "Religious and Moral Education": RME,
  "History": History,
  "Career Technology": CareerTechnology,
  "Career Tech": CareerTechnology,
  "Creative Arts": CreativeArts,
  "Creative Arts and Design": CreativeArts,
  "French": French,
  "Physical Education": PhysicalEducation,
  "Physical and Health Education": PhysicalEducation,
  "PE": PhysicalEducation,
  "P.E.": PhysicalEducation,
  "Ghanaian Language": GhanaianLanguage,
  "Ghanaian Languages": GhanaianLanguage,
  "Asante Twi": GhanaianLanguage,
  "Akuapem Twi": GhanaianLanguage,
  "Fante": GhanaianLanguage,
  "Ga": GhanaianLanguage,
  "Ewe": GhanaianLanguage,
  "Dangme": GhanaianLanguage,
  "Twi": GhanaianLanguage,
};
