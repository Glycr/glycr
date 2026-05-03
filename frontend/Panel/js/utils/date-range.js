// ===============================================
// DATE RANGE HELPER
// ===============================================

function applyDateRangeFilter(dateStr, from, to) {
  if (!from && !to) return true;
  const d = new Date(dateStr);
  if (isNaN(d)) return true;
  if (from && d < new Date(from))             return false;
  if (to   && d > new Date(to + 'T23:59:59')) return false;
  return true;
}
