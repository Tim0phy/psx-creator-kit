import catalogJson from "../catalog.json";

export default catalogJson;

export const SLOT_LABELS = {
  face: "EYES",
  head: "HAIR",
  top: "TOP",
  bottom: "BOTTOM",
  shoes: "SHOES",
  accessories: "ACCESSORIES",
  style: "STYLE",
};

export function itemsForSlot(slot) {
  return catalogJson.items.filter((i) => i.slot === slot);
}
