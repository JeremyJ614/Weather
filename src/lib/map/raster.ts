import type { AnyMap } from "@/features/map/WeatherMap";

const NOAA = "https://mapservices.weather.noaa.gov";

/** ArcGIS export URL as a map tile template (both map libraries fill in {bbox-epsg-3857}). */
export const heatRiskTiles = (timeMs: number) =>
  `${NOAA}/experimental/rest/services/NWS_HeatRisk/ImageServer/exportImage?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&time=${timeMs}&renderingRule=%7B%22rasterFunction%22%3A%22heatrisk.rft%22%7D&f=image`;

export const eddiTiles = (layer: number) =>
  `${NOAA}/experimental/rest/services/eddi_monitoring/MapServer/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&layers=show:${layer}&f=image`;

/** Adds or replaces a raster overlay; works on Mapbox and MapLibre maps. */
export function setRaster(
  map: AnyMap,
  id: string,
  tiles: string,
  opacity = 0.8,
) {
  const m = map as unknown as {
    getLayer(id: string): unknown;
    getSource(id: string): unknown;
    removeLayer(id: string): void;
    removeSource(id: string): void;
    addSource(id: string, s: object): void;
    addLayer(l: object): void;
  };
  if (m.getLayer(id)) m.removeLayer(id);
  if (m.getSource(id)) m.removeSource(id);
  m.addSource(id, { type: "raster", tiles: [tiles], tileSize: 256 });
  m.addLayer({
    id,
    type: "raster",
    source: id,
    paint: { "raster-opacity": opacity },
  });
}
