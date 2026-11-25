import backyard from "../data/areas/backyard.json";
import basement from "../data/areas/basement.json";
import bathroom from "../data/areas/bathroom.json";
import garage from "../data/areas/garage.json";
import homedepot from "../data/areas/homedepot.json";
import house from "../data/areas/house.json";
import tunnels from "../data/areas/tunnels.json";
import type { AreaDefinition } from "./content";

/** Every area. Add new area files here. */
export const areas = [house, garage, basement, bathroom, homedepot, backyard, tunnels] as unknown as AreaDefinition[];
