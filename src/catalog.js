import catalogJson from "../catalog.json";

export default catalogJson;

// M6.5: pose presets live in catalog.json ("poses" array)
export const POSE_PRESETS = catalogJson.poses ?? [];

export const SLOT_LABELS = {
  face: "EYES",
  head: "HAIR",
  body: "BODY",
  top: "TOP",
  bottom: "BOTTOM",
  shoes: "SHOES",
  accessories: "ACCESSORIES",
  pose: "POSE",
  style: "STYLE",
};

export function itemsForSlot(slot) {
  return catalogJson.items.filter((i) => i.slot === slot);
}
