import type { PlantUmlImportResult } from './mapper';
import { mapPlantUml } from './mapper';
import { parsePlantUml } from './parser';

export function importPlantUml(source: string): PlantUmlImportResult {
  return mapPlantUml(parsePlantUml(source));
}

export function isPlantUmlPath(path: string): boolean {
  return /\.(?:puml|plantuml|pu)$/i.test(path);
}
