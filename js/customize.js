//NOU: MAGAZINUL: culori si palarii cumparate cu monedele adunate
const ITEMS = [
  { id: "color-orange", group: "color", name: "Portocaliu", price: 0, color: 0xff8a5c },
  { id: "color-mint", group: "color", name: "Menta", price: 40, color: 0x5cd6b0 },
  { id: "color-violet", group: "color", name: "Violet", price: 80, color: 0xa47bff },
  { id: "color-gold", group: "color", name: "Auriu", price: 200, color: 0xf2c14a },
  { id: "hat-none", group: "hat", name: "Fara palarie", price: 0, hat: "none" },
  { id: "hat-cone", group: "hat", name: "Coif", price: 60, hat: "cone" },
  { id: "hat-crown", group: "hat", name: "Coroana", price: 150, hat: "crown" },
  { id: "hat-halo", group: "hat", name: "Aureola", price: 300, hat: "halo" },
];

export function createCustomize(save, player) {
  const find = (id) => ITEMS.find((item) => item.id === id);

  function apply() {
    player.setLook(find(save.data.color).color, find(save.data.hat).hat);
  }

  //Daca il ai, il imbraci; altfel il cumperi, daca ai destule monede
  function choose(id) {
    const item = find(id);
    if (!save.data.owned.includes(id)) {
      if (save.data.coins < item.price) return false;
      save.data.coins -= item.price;
      save.data.owned.push(id);
    }
    save.data[item.group] = id;
    save.write();
    apply();
    return true;
  }

  apply();
  return { items: ITEMS, choose };
}
