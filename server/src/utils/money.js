// Prevents IEEE-754 floating point drift (e.g. 3 * 19.99 = 59.97000000000001)
const toCents = (amount) => Math.round(Number(amount) * 100);
const fromCents = (cents) => (cents / 100).toFixed(2);

const multiplyCurrency = (unitPrice, quantity) => {
  const unitCents = toCents(unitPrice);
  const totalCents = Math.round(unitCents * Number(quantity));
  return Number(fromCents(totalCents));
};

module.exports = { toCents, fromCents, multiplyCurrency };
